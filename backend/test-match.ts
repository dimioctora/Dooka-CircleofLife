import neo4j from 'neo4j-driver';

const driver = neo4j.driver(
  'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', 'password')
);

async function testMatch() {
  const session = driver.session();
  try {
    const res1 = await session.run('MATCH (n:Person) WHERE n.person_id = 2 RETURN count(n) as c');
    const res2 = await session.run('MATCH (n:Person) WHERE n.person_id = "2" RETURN count(n) as c');
    console.log('NUMERIC MATCH (2):', res1.records[0].get('c').toInt());
    console.log('STRING MATCH ("2"):', res2.records[0].get('c').toInt());

    const res3 = await session.run('MATCH (n:Person) RETURN n.person_id as pid LIMIT 5');
    console.log('Actual types in DB:');
    res3.records.forEach(r => {
      const pid = r.get('pid');
      console.log(`Value: ${pid}, Type: ${typeof pid}`);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

testMatch();
