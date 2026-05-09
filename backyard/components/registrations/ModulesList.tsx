import { STATIC_MODULE_DEFINITIONS } from '@/lib/modules/definitions';

export function ModulesList({ ids }: { ids: string[] }) {
  if (ids.length === 0) return <span className="text-gray-500">None</span>;
  return (
    <ul className="list-disc pl-5">
      {ids.map((id) => {
        const def = STATIC_MODULE_DEFINITIONS[id];
        const name = (def?.displayName as string | undefined) ?? id;
        return <li key={id}>{name}</li>;
      })}
    </ul>
  );
}
