import neo4j from 'neo4j-driver';

const driver = neo4j.driver(
  'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', 'password')
);

async function reproduce() {
  const session = driver.session();
  try {
    const person_id = '2';
    const depth = 3;
    const fallbackQuery = `
      MATCH (p:Person {person_id: $person_id})
      OPTIONAL MATCH path = (p)-[:PARENT|CHILD|SPOUSE*0..${depth}]-(relative)
      RETURN nodes(path) as nodes, relationships(path) as rels
    `;
    
    const result = await session.run(fallbackQuery, { person_id });
    console.log('Rows returned:', result.records.length);

    result.records.forEach((r, i) => {
      const nodes = r.get('nodes');
      const rels = r.get('rels');
      console.log(`Row ${i} nodes count:`, nodes?.length || 0);
      console.log(`Row ${i} rels count:`, rels?.length || 0);
      
      if (nodes && nodes.length > 0) {
          nodes.forEach(n => console.log('Node ElementId:', n.elementId));
      }
      if (rels && rels.length > 0) {
          rels.forEach(rel => {
              console.log(`Rel Start: ${rel.startNodeElementId}, End: ${rel.endNodeElementId}`);
          });
      }
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

reproduce();
