type CopyBlockProps = {
  title: string;
  content: string;
};

export function CopyBlock({ title, content }: CopyBlockProps) {
  async function handleCopy() {
    await navigator.clipboard.writeText(content);
  }

  return (
    <section className="card">
      <div className="section-heading">
        <h3>{title}</h3>
        <button className="ghost-button" onClick={handleCopy} type="button">
          Kopier
        </button>
      </div>
      <pre className="copy-block">{content}</pre>
    </section>
  );
}
