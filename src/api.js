const express = require('express');
const bodyParser = require('body-parser');
const dbClient = require('./dbClient');
const { stationTable, connectionTable} = require('./dbClient');

// Set up database connection.
const knex = require('knex')({
  client: 'pg',
  connection: {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'subway_system',
    password: process.env.DB_PASS || 'password',
    port: parseInt(process.env.DB_PORT || '5432'),
  }
});

// Set up express app.
const app = express();

// Set up middleware.
app.use(bodyParser.json());

let graph = {};

// Part 1.
app.post('/train-line', async (req, res) => {
  const { name, stations, fare } = req.body;

  try {
    // Begin transaction.
    await dbClient.begin();

    // Add train line.
    const trainLine = await dbClient.addOrUpdateTrainLine(name, fare);

    // Add stations and connections.
    const trainLineId = trainLine.id;
    const stationIdsMap = await dbClient.addTrainStations(stations);
    await dbClient.insertConnections(trainLineId, stationIdsMap, stations);

    // Commit transaction.
    await dbClient.commit();
    
    // Rebuild graph upon changes.
    graph = await buildGraph();

    res.status(201).json({ message: 'Train line was created successfully.' });

  } catch (err) {
    await dbClient.rollback();
    console.error(err);
    return res.status(500).json({ error: err.message });
  } finally {
    await dbClient.release();
  }
});

app.get('/route', async (req, res) => {
  const { origin, destination } = req.query;

  // Validate origin and destination.
  if(!origin || !destination) {
    return res.status(400).json({ error: 'Origin and destination are required.' });
  }

  // If origin and destination are the same, return success.
  if (origin === destination) {
    return res.status(200).json({ route: [origin] });
  }

  // Validate that origin and destination exist.
  const originExists = await dbClient.staionExists(origin);
  const destExists = await dbClient.staionExists(destination);
  if (!originExists || !destExists) {
    return res.status(400).json({ error: 'Origin and destination must both exist.' });
  }

  try {
    // Find route.
    const route = dijkstra(graph, origin, destination);
    if (route.length <= 1) {
      return res.status(400).json({ error: 'No route found' });
    }

    return res.status(200).json({ route });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Part 2.
app.post('/card', async (req, res) => {
  const { number, amount } = req.body;

  // Validate card number and amount.
  if (!number || !amount || amount < 0) {
    return res.status(400).json({ error: 'Invalid card number or amount.' });
  }

  try {
    // Add or update card.
    const card = await dbClient.addOrUpdateCard(number, amount);
    return res.status(201).json({ message: 'Card was created/updated successfully.', card });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }finally {
    await dbClient.release();
  }
});

app.post('/station/:station/enter', async (req, res) => {
  const { station } = req.params;
  const { card_number } = req.body;

  // Validate that the station exists.
  const staionExists = await dbClient.staionExists(station);
  if (!staionExists) {
    return res.status(400).json({ error: 'Station does not exist.' });
  }

  // Validate that the card exists.
  const card = await dbClient.getCardByNumber(card_number);
  if (!card) {
    return res.status(404).json({ error: 'Card was not found.' });
  }

  // Validate that the card has enough balance.
  const fare = await dbClient.getFareForStation(station); 
  if (card.balance < fare) {
    return res.status(400).json({ error: 'Insufficient prepaid balance.' });
  }

  try {
    // Begin transaction.
    await dbClient.begin();

    // Log enter and update card balance.
    await dbClient.logRide(card_number, station, 'enter', fare);
    const updatedCard = await dbClient.updateCardBalance(card.id, fare);

    // Commit transaction.
    await dbClient.commit();

    return res.status(200).json({ amount: updatedCard.balance });

  } catch (err) {
    await dbClient.rollback();
    return res.status(500).json({ error: err.message });
  } finally {
    await dbClient.release(); 
  }
});

app.post('/station/:station/exit', async (req, res) => {
  const { station } = req.params;
  const { card_number } = req.body;

  // Validate that the station exists.
  const staionExists = await dbClient.staionExists(station);
  if (!staionExists) {
    return res.status(400).json({ error: 'Station does not exist.' });
  }

  // Validate that the card exists.
  const card = await dbClient.getCardByNumber(card_number);
  if (!card) {
    return res.status(404).json({ error: 'Card was not found.' });
  }

  try {
    // Log exit.
    await dbClient.logRide(card_number, station, 'exit');
    return res.status(200).json({ amount: card.balance });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


const buildGraph = async () => {
  // Get stations and connections from database.
  const stations = await dbClient.query(knex(stationTable).select('id', 'name'));
  const connections = await dbClient.query(knex(connectionTable).select('train_line_id', 'station1_id', 'station2_id'));

  const newGraph = {};

  // Set up graph.
  stations.forEach(station => {
    newGraph[station.name] = [];
  });

  // Add connections to graph.
  connections.forEach(connection => {
    const station1 = stations.find(station => station.id === connection.station1_id).name;
    const station2 = stations.find(station => station.id === connection.station2_id).name;
    newGraph[station1].push(station2);
    newGraph[station2].push(station1);
  });

  return newGraph;
};

const dijkstra = (graph, startNode, endNode) => {
  // Initialize distances, visited, previous, and queue.
  const distances = {}; 
  const visited = {}; 
  const previous = {}; 
  const queue = []; 

  for (let node in graph) {
    if (node === startNode) {
      distances[node] = 0;
      queue.push([node, 0]);
    } else {
      distances[node] = Infinity;
      queue.push([node, Infinity]);
    }
    visited[node] = false;
    previous[node] = null;
  }
  // Sort queue by distance.
  queue.sort((a, b) => a[1] - b[1]); 

  // Traverse graph.
  while (queue.length > 0) {
    // Get current node and distance.
    const [currentNode, currentDistance] = queue.shift();
    visited[currentNode] = true;

    // If we reached the end node, reconstruct and return path.
    if (currentNode === endNode) {
      const path = [];
      let node = endNode;
      while (previous[node]) {
        path.unshift(node);
        node = previous[node];
      }
      path.unshift(startNode);
      return path;
    }

    // Update distances and previous nodes.
    graph[currentNode].forEach(neighbor => {
      // If neighbor has not been visited.
      if (!visited[neighbor]) {
        // Calculate new distance.
        const newDistance = currentDistance + 1;

        // Update distances and previous nodes if new distance is shorter.
        if (newDistance < distances[neighbor]) {
          distances[neighbor] = newDistance;
          previous[neighbor] = currentNode;
          queue.push([neighbor, newDistance]);
        }
      }
    });

    // Sort queue by distance.
    queue.sort((a, b) => a[1] - b[1]);
  }

  return [];
};

const init = async () => {
  graph = await buildGraph();
};

if (require.main === module) {
  init();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = { app };