import { serve } from "inngest/next"
import { alternativeCreated } from "~/functions/alternative-created"
import { analyzeTools } from "~/functions/cron.analyze-tools"
import { fetchTools } from "~/functions/cron.fetch-tools"
import { publishTools } from "~/functions/cron.publish-tools"
import { toolExpedited } from "~/functions/tool-expedited"
import { toolFeatured } from "~/functions/tool-featured"
import { toolScheduled } from "~/functions/tool-scheduled"
import { toolSubmitted } from "~/functions/tool-submitted"
import { inngest } from "~/services/inngest"

export const maxDuration = 60

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    fetchTools,
    analyzeTools,
    publishTools,
    toolScheduled,
    toolSubmitted,
    toolExpedited,
    toolFeatured,
    alternativeCreated,
  ],
})
