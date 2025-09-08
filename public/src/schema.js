// src/schema.js
export function schemaFromIndex(index, strict = true) {
  const classes = Array.from(index.byClass.keys());
  const psets = {};
  for (const [, rec] of index.byExpressID.entries()) {
    for (const p in rec.psets) {
      psets[p] = psets[p] || new Set();
      for (const prop in rec.psets[p]) {
        psets[p].add(prop);
      }
    }
  }
  const psetArr = Object.entries(psets).map(([pset, set]) => ({ pset, props: Array.from(set) }));
  return {
    classes,
    psets: psetArr,
    fields: ["GlobalId","ExpressID","Name","PredefinedType","ObjectType","Tag","IfcType"],
    // In strict mode we do not include any values
    values: strict ? {} : {}
  };
}
