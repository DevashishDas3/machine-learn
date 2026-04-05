"use client";

import { motion } from "framer-motion";

interface BentoCardProps {
  icon: React.ReactNode;
  title: string;
  audience: string;
  description: string;
  index: number;
}

function BentoCard({ icon, title, audience, description, index }: BentoCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="group relative border border-white/10 bg-obsidian p-6 transition-all duration-300 hover:border-azure/50 hover:bg-azure/5 md:p-8"
    >
      {/* Corner accent */}
      <div className="absolute right-0 top-0 h-8 w-8 border-r border-t border-white/10 transition-colors group-hover:border-azure/50" />
      <div className="absolute bottom-0 left-0 h-8 w-8 border-b border-l border-white/10 transition-colors group-hover:border-azure/50" />

      {/* Icon */}
      <div className="mb-4 text-azure transition-transform duration-300 group-hover:scale-110">
        {icon}
      </div>

      {/* Audience tag */}
      <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-azure">
        {audience}
      </p>

      {/* Title */}
      <h3 className="mb-3 font-mono text-lg font-semibold text-paper transition-colors group-hover:text-azure">
        {title}
      </h3>

      {/* Description */}
      <p className="font-mono text-sm leading-relaxed text-paper/50 transition-colors group-hover:text-paper/70">
        {description}
      </p>

      {/* Hover indicator */}
      <div className="mt-6 flex items-center gap-2 font-mono text-xs text-paper/30 transition-colors group-hover:text-azure">
        <span className="inline-block h-[1px] w-4 bg-current transition-all group-hover:w-8" />
        <span className="uppercase tracking-widest">Learn more</span>
      </div>
    </motion.div>
  );
}

export default function BentoGrid() {
  const cards = [
    {
      audience: "For Data Scientists",
      title: "Rapid Benchmarking",
      description:
        "Test multiple architectures in parallel. Compare CNNs, transformers, and baselines simultaneously without manual setup or GPU juggling.",
      icon: (
        <svg
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605"
          />
        </svg>
      ),
    },
    {
      audience: "For Software Engineers",
      title: "Zero-Config ML",
      description:
        "No MLOps background required. Describe your goal in plain English. The agents handle architecture selection, training, and hyperparameter tuning.",
      icon: (
        <svg
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
      ),
    },
    {
      audience: "For Hackers",
      title: "Ship Models Faster",
      description:
        "From hackathon idea to deployed model in hours, not weeks. Auto-generated reports with accuracy metrics, confusion matrices, and deployment code.",
      icon: (
        <svg
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
          />
        </svg>
      ),
    },
  ];

  return (
    <section className="relative z-10 border-t border-white/10 bg-obsidian py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-12 text-center md:mb-16"
        >
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-azure">
            Built For
          </p>
          <h2 className="font-mono text-2xl font-bold tracking-tight text-paper md:text-3xl">
            Who It&apos;s For
          </h2>
        </motion.div>

        {/* Bento grid */}
        <div className="grid gap-[1px] bg-white/5 md:grid-cols-3">
          {cards.map((card, index) => (
            <BentoCard
              key={card.title}
              index={index}
              audience={card.audience}
              title={card.title}
              description={card.description}
              icon={card.icon}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
