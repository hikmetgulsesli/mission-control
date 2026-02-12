interface GlitchTextProps {
  text: string;
  tag?: 'h1' | 'h2' | 'h3' | 'span';
}

export function GlitchText({ text, tag: Tag = 'h1' }: GlitchTextProps) {
  return (
    <Tag className="glitch" data-text={text}>
      {text}
    </Tag>
  );
}
