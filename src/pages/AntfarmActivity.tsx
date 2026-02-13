import { usePolling } from '../hooks/usePolling';
import { api } from '../lib/api';
import { GlitchText } from '../components/GlitchText';
import { AgentMiniGrid } from '../components/AgentMiniGrid';
import { PipelineView } from '../components/PipelineView';
import { AntfarmFeed } from '../components/AntfarmFeed';
import { WorkflowAgentStats } from '../components/WorkflowAgentStats';

export function AntfarmActivity() {
  const { data: agents } = usePolling(api.agents, 30_000);
  const { data: pipeline } = usePolling(api.antfarmPipeline, 10_000);
  const { data: activity } = usePolling(api.antfarmActivity, 10_000);
  const { data: wfAgents } = usePolling(api.antfarmAgents, 30_000);
  const { data: alerts } = usePolling(api.antfarmAlerts, 15_000);

  return (
    <div className="af-page">
      <div className="af-page__header">
        <GlitchText text="ANTFARM" />
        <div className="af-page__subtitle">Agent Activity &amp; Workflow Pipeline</div>
      </div>

      {/* Top half: Our 10 agents */}
      <section className="af-section">
        <div className="af-section__title">OUR AGENTS</div>
        <AgentMiniGrid agents={agents || []} pipeline={pipeline || []} />
      </section>

      {/* Bottom half: 3-column layout */}
      <section className="af-bottom">
        <div className="af-bottom__col af-bottom__col--pipeline">
          <div className="af-section__title">PIPELINE</div>
          <PipelineView runs={pipeline || []} />
        </div>
        <div className="af-bottom__col af-bottom__col--feed">
          <div className="af-section__title">ACTIVITY FEED</div>
          <AntfarmFeed events={activity || []} />
        </div>
        <div className="af-bottom__col af-bottom__col--stats">
          <div className="af-section__title">STATS &amp; ALERTS</div>
          <WorkflowAgentStats agents={wfAgents || []} alerts={alerts} />
        </div>
      </section>
    </div>
  );
}
