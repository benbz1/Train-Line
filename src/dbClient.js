'use strict';

// Import the knex library.
const knex = require('knex')({
  client: 'pg',
  connection: {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'subway_system',
    password: process.env.DB_PASS || 'password',
    port: parseInt(process.env.DB_PORT || '5432'),
  },
});

// Define the table names.
const trainLineTable = 'public.train_line';
const stationTable = 'public.station';
const connectionTable = 'public.connection';
const cardTable = 'public.card';
const rideTable = 'public.ride';

// Export the table names.
exports.trainLineTable = trainLineTable;
exports.stationTable = stationTable;
exports.connectionTable = connectionTable;
exports.cardTable = cardTable;
exports.rideTable = rideTable;

exports.query = async (queryBuilder) => {
  try {
    const result = await queryBuilder;
    return result;
  } catch (error) {
    console.error('Error executing query', error);
    throw error;
  }
};

exports.begin = async () => {
  await knex.raw('BEGIN');
};

exports.commit = async () => {
  await knex.raw('COMMIT');
};

exports.rollback = async () => {
  await knex.raw('ROLLBACK');
};

exports.release = async () => {

};

exports.reset = async () => {
  // Delete all records from the tables.
  // Mainly used for testing.
  for (const table of [
    connectionTable,
    rideTable,
    stationTable,
    trainLineTable,
    cardTable,
  ]) {
    await knex(table).del();
  }
};

// Create or update train line.
exports.addOrUpdateTrainLine = async (name, fare) => {
  const sql = knex(trainLineTable)
    .insert({ name, fare })
    .onConflict('name')
    .merge()
    .returning('*');
  const records = await this.query(sql);
  return records[0];
};

// Create or update train stations.
exports.addTrainStations = async (stationNames) => {
  const sql = knex(stationTable)
    .insert(stationNames.map((name) => ({ name })))
    .onConflict('name')
    .merge()
    .returning(['id', 'name']);

  const result = await this.query(sql);
  return result.reduce((map, row) => {
    map[row.name] = row.id;
    return map;
  }, {});
};

// Insert connections between stations.
exports.insertConnections = async (trainLineId, stationIdsMap, stationNames) => {
  const connectionPairs = stationNames.slice(0, -1).map((name, i) => ({
    train_line_id: trainLineId,
    station1_id: stationIdsMap[name],
    station2_id: stationIdsMap[stationNames[i + 1]],
  }));

  const insertConnectionsQuery = knex(connectionTable)
    .insert(connectionPairs)
    .onConflict(['train_line_id', 'station1_id', 'station2_id'])
    .ignore()
    .returning('*');

  await this.query(insertConnectionsQuery);
};

// Add or update card.
exports.addOrUpdateCard = async (number, amount) => {
  const sql = knex(cardTable)
    .insert({ number, balance: amount })
    .onConflict('number')
    .merge({ balance: knex.raw(cardTable + '.balance + EXCLUDED.balance') })
    .returning('*');
  const records = await this.query(sql);
  return records[0];
};

// Get card by number.
exports.getCardByNumber = async (number) => {
  const sql = knex(cardTable).select('*').where({ number });
  const records = await this.query(sql);
  return records[0];
};

// Log ride.
exports.logRide = async (card_number, station, action, fare) => {
  const sql = knex(rideTable)
    .insert({ card_number: card_number, station, action, fare })
    .returning('*');
  const records = await this.query(sql);
  return records[0];
};

// Update card balance
exports.updateCardBalance = async (cardId, fare) => {
  const sql = knex(cardTable)
    .update({ balance: knex.raw('balance - ?', [fare]) })
    .where({ id: cardId })
    .returning('*');
  const records = await this.query(sql);
  return records[0];
};

exports.getFareForStation = async (station) => {
  const result = await knex({ tl: trainLineTable })
    .join({ c: connectionTable }, 'tl.id', 'c.train_line_id')
    .join({ s: stationTable }, function () {
      this.on('s.id', '=', 'c.station1_id').orOn('s.id', '=', 'c.station2_id');
    })
    .where('s.name', station)
    .min('tl.fare as min_fare')
    .first();
  return result ? parseFloat(result.min_fare) : null;
};

exports.staionExists = async (station) => {
  const sql = knex(stationTable).select('*').where({ name: station });
  const records = await this.query(sql);
  return records.length > 0;
};
