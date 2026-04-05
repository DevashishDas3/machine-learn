export function AwaitingCommandState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <pre className="text-azure/40 text-[10px] leading-tight font-mono mb-8 select-none">
{`
   +--------------------------------------+ 
   |                                      |
   |     OOO  OOOOO  OOOOO  O   O  OOO   |
   |     OOOO O   O  O   O  OOO O  OOOO  |
   |     O  O OOO    OOO    O   O  O OO  |
   |     O  O OOOOO  OOOOO  O   O  O  O  |
   |                                      |
   |        SWARM ORCHESTRATOR            |
   |                                      |
   +--------------------------------------+ 
`}
      </pre>

      <div className="font-mono space-y-3 max-w-md">
        <p className="text-2xl text-paper tracking-tight">{">"} system.ready()</p>
        <p className="text-sm text-paper/40 leading-relaxed">
          Describe your ML task below to initiate the agent swarm.
          <br />
          Upload a dataset or specify a path on Modal Volume.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-3 gap-4 text-left max-w-xl">
        {[
          { label: "PlanAgent", desc: "Architecture selection" },
          { label: "ImplementAgent", desc: "A100/H100 training" },
          { label: "TuneAgent", desc: "Hyperparameter search" },
        ].map((item) => (
          <div key={item.label} className="border border-white/10 p-3">
            <p className="font-mono text-[10px] text-azure uppercase tracking-wider">{item.label}</p>
            <p className="font-mono text-[10px] text-paper/30 mt-1">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
