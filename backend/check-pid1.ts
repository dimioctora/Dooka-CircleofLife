import neo4j from 'neo4j-driver';

const driver = neo4j.driver(
  'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', 'password')
);

async function checkPid1() {
  const session = driver.session();
  try {
    const res = await session.run('MATCH (n:Person) WHERE n.person_id = "1" RETURN count(n) as c');
    console.log('PID 1 MATCH:', res.records[0].get('c').toInt());
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

checkPid1();
