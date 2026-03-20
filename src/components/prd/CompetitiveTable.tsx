interface CompetitiveTableProps {
  analyses: any[];
  urls: string[];
}

export function CompetitiveTable({ analyses, urls }: CompetitiveTableProps) {
  if (!analyses || analyses.length < 2) return null;

  const fields = ['title', 'techStack', 'colors', 'fonts', 'features', 'sections'];

  return (
    <div className="prd-competitive">
      <h3>Karsilastirmali Analiz</h3>
      <div className="prd-competitive__table-wrap">
        <table className="prd-competitive__table">
          <thead>
            <tr>
              <th>Ozellik</th>
              {analyses.map((a, i) => (
                <th key={i}>{a.title || urls[i] || `Site ${i + 1}`}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map(field => (
              <tr key={field}>
                <td className="prd-competitive__field">{field}</td>
                {analyses.map((a, i) => (
                  <td key={i}>
                    {typeof a[field] === 'object'
                      ? Array.isArray(a[field])
                        ? a[field].join(', ')
                        : JSON.stringify(a[field])
                      : a[field] || '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
