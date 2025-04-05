import { ToolStatus } from "@openalternative/db/client"
import { NonRetriableError } from "inngest"
import { revalidateTag } from "next/cache"
import { getPageAnalytics } from "~/lib/analytics"
import { getMilestoneReached } from "~/lib/milestones"
import { getToolRepositoryData } from "~/lib/repositories"
import { getPostMilestoneTemplate, getPostTemplate, sendSocialPost } from "~/lib/socials"
import { isToolPublished } from "~/lib/tools"
import { inngest } from "~/services/inngest"
import { tryCatch } from "~/utils/helpers"

export const fetchTools = inngest.createFunction(
  { id: "fetch-tools", retries: 0 },
  { cron: "TZ=Europe/Warsaw 0 0 * * *" }, // Every day at midnight

  async ({ step, db, logger }) => {
    const tools = await step.run("fetch-tools", async () => {
      return await db.tool.findMany({
        where: { status: { in: [ToolStatus.Published, ToolStatus.Scheduled] } },
      })
    })

    await Promise.all([
      // Fetch repository data and handle milestones
      step.run("fetch-repository-data", async () => {
        return await Promise.allSettled(
          tools.map(async tool => {
            const result = await tryCatch(getToolRepositoryData(tool.repositoryUrl))

            if (result.error) {
              logger.error(`Failed to fetch repository data for ${tool.name}`, {
                error: result.error,
                slug: tool.slug,
              })

              return null
            }

            if (!result.data) {
              return null
            }

            if (isToolPublished(tool) && result.data.stars > tool.stars) {
              const milestone = getMilestoneReached(tool.stars, result.data.stars)

              if (milestone) {
                const template = getPostMilestoneTemplate(tool, milestone)
                await sendSocialPost(template, tool)
              }
            }

            await db.tool.update({
              where: { id: tool.id },
              data: result.data,
            })
          }),
        )
      }),

      // Fetch analytics data
      step.run("fetch-analytics-data", async () => {
        return await Promise.allSettled(
          tools.filter(isToolPublished).map(async tool => {
            const result = await tryCatch(getPageAnalytics(`/${tool.slug}`))

            if (result.error) {
              logger.error(`Failed to fetch analytics data for ${tool.name}`, {
                error: result.error,
                slug: tool.slug,
              })

              return null
            }

            await db.tool.update({
              where: { id: tool.id },
              data: { pageviews: result.data.pageviews ?? tool.pageviews ?? 0 },
            })
          }),
        )
      }),
    ])

    // Post on Socials about a random tool
    await step.run("post-on-socials", async () => {
      const publishedTools = tools.filter(isToolPublished)
      const tool = publishedTools[Math.floor(Math.random() * publishedTools.length)]

      if (tool) {
        const template = await getPostTemplate(tool)
        const result = await tryCatch(sendSocialPost(template, tool))

        if (result.error) {
          throw new NonRetriableError(
            result.error instanceof Error ? result.error.message : "Unknown error",
          )
        }

        return result.data
      }
    })

    // Disconnect from DB
    await step.run("disconnect-from-db", async () => {
      return await db.$disconnect()
    })

    // Revalidate cache
    await step.run("revalidate-cache", async () => {
      revalidateTag("tools")
      revalidateTag("tool")
    })
  },
)
