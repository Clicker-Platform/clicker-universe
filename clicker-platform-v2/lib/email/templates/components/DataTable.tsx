type Row = { label: string; value: string };

export function DataTable({ rows }: { rows: Row[] }) {
  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td
              style={{
                padding: '8px 12px',
                fontWeight: 600,
                color: '#374151',
                borderBottom: '1px solid #f3f4f6',
                width: '140px',
              }}
            >
              {r.label}
            </td>
            <td
              style={{
                padding: '8px 12px',
                color: '#111827',
                borderBottom: '1px solid #f3f4f6',
              }}
            >
              {r.value || '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
