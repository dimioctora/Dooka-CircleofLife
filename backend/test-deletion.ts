import neo4j from 'neo4j-driver';

const driver = neo4j.driver(
  'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', 'password')
);

async function testDeletion() {
  const session = driver.session();
  try {
    const person_id = '2';
    
    // Initial nodes
    const nodes = [
      { id: '2', type: 'person', data: { name: 'Root' }, position: { x: 0, y: 0 } },
      { id: 'rel-2-999', type: 'person', data: { name: 'To Be Deleted' }, position: { x: 100, y: 100 } }
    ];

    console.log('--- Phase 1: Create 2 nodes ---');
    // Using simpleCypher for testing logic similarity
    await session.run('MERGE (p:Person {person_id: "2"}) SET p.name = "Root"');
    await session.run('MERGE (p:Person {person_id: "rel-2-999"}) SET p.name = "Delete Me"');
    
    const countBefore = await session.run('MATCH (p:Person) WHERE p.person_id IN ["2", "rel-2-999"] RETURN count(p) as c');
    console.log('Nodes before deletion:', countBefore.records[0].get('c').toInt());

    console.log('--- Phase 2: Run Deletion Logic (Simulating saveGraph) ---');
    const payloadIds = ['2']; // rel-2-999 is MISSING
    
    const cleanupQuery = `
      MATCH (n)
      WHERE (
        (n:Person AND (n.person_id = $pid OR n.person_id STARTS WITH $relPrefix))
        OR 
        (n:Union AND (n.union_id = $pid OR n.union_id STARTS WITH $unionPrefix))
      )
      AND (
        (n:Person AND NOT n.person_id IN $payloadIds)
        OR
        (n:Union AND NOT n.union_id IN $payloadIds)
      )
      DETACH DELETE n
    `;

    await session.run(cleanupQuery, { 
      pid: person_id, 
      relPrefix: `rel-${person_id}-`, 
      unionPrefix: `union-${person_id}-`,
      payloadIds: payloadIds 
    });

    const countAfter = await session.run('MATCH (p:Person) WHERE p.person_id IN ["2", "rel-2-999"] RETURN count(p) as c');
    console.log('Nodes after deletion:', countAfter.records[0].get('c').toInt());

    if (countAfter.records[0].get('c').toInt() === 1) {
        console.log('SUCCESS: Node rel-2-999 was successfully deleted!');
    } else {
        console.log('FAILURE: Node was not deleted.');
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

testDeletion();
