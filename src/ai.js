
import { schemaFromIndex } from './schema.js';

export async function planFilterWithLLM({ apiKey, model, userPrompt, index, strict = true }) {
  const schema = schemaFromIndex(index, strict);
  const system = `You are a BIM query planner. Output ONLY a JSON object as specified. If unsure, prefer "contains" on Name or IfcType.`;

  const tool = `Schema:
- Supported IFC classes: ${JSON.stringify(schema.classes)}
- Property sets and properties: ${JSON.stringify(schema.psets)}
- Element fields: ${JSON.stringify(schema.fields)}

Return JSON:
{
  "classes": [IFC_CLASS_NAMES],
  "conditions": [
    {"field":"IfcType|Name|PredefinedType|ObjectType|Tag|pset:Pset:Prop",
     "op":"equals|contains|startsWith|in|regex|gt|lt",
     "value": any}
  ],
  "limit": <integer|null>
}`;

  const messages = [
    { role: 'system', content: system },
    { role: 'system', content: tool },
    { role: 'user', content: userPrompt }
  ];

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, temperature: 0, messages, response_format: { type: 'json_object' } })
  });
  if (!resp.ok) throw new Error(`OpenAI error: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  const txt = data.choices?.[0]?.message?.content || '{}';
  return JSON.parse(txt);
}
