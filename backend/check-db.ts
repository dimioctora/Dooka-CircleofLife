import neo4j from 'neo4j-driver';

const driver = neo4j.driver(
  'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', 'password')
);

async function checkDb() {
  const session = driver.session();
  try {
    console.log('--- PERSON NODES ---');
    const persons = await session.run('MATCH (n:Person) RETURN n LIMIT 10');
    persons.records.forEach(r => {
      console.log(JSON.stringify(r.get('n').properties, null, 2));
    });

    console.log('\n--- RELATIONSHIPS ---');
    const rels = await session.run('MATCH ()-[r]->() RETURN r LIMIT 10');
    rels.records.forEach(r => {
      const rel = r.get('r');
      console.log(`${rel.startNodeElementId} -[${rel.type}]-> ${rel.endNodeElementId}`);
    });
  } catch (err) {
    console.error('Error connecting to Neo4j:', err.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

checkDb();
