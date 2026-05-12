'use client';


import { SkillDefinition } from '../types';
import { AGENT_LABELS } from '../config/skills-catalog';

interface Props {
  skill: SkillDefinition;
  selected?: boolean;
  onSelect: (skill: SkillDefinition) => void;
}

export default function SkillCard({ skill, selected, onSelect }: Props) {
  const agent = AGENT_LABELS[skill.agentId] ?? { label: skill.agentId, color: 'bg-gray-100 text-gray-600 border-gray-200' };

  return (
    <button
      onClick={() => onSelect(skill)}
      className={`w-full text-left p-4 rounded-2xl border transition-all hover:shadow-md ${
        selected
          ? 'border-brand-dark bg-brand-dark/5 shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300 shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-semibold text-gray-900 text-sm">{skill.label}</p>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed mb-3">{skill.description}</p>
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${agent.color}`}>
        {agent.label}
      </span>
    </button>
  );
}
