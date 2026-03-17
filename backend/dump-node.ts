import neo4j from 'neo4j-driver';

const driver = neo4j.driver(
  'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', 'password')
);

async function dumpNode() {
  const session = driver.session();
  try {
    const res = await session.run('MATCH (n:Person) WHERE n.person_id = "2" RETURN n, keys(n) as keys');
    res.records.forEach(r => {
      console.log('KEYS:', r.get('keys'));
      console.log('PROPS:', JSON.stringify(r.get('n').properties, null, 2));
    });
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

dumpNode();
