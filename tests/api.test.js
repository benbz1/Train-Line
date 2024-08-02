'use strict';

const request = require('supertest');
const { app } = require('../src/api');
const dbClient = require('../src/dbClient');

beforeAll(async () => {
});

beforeEach(async () => {
});

afterEach(async () => {
  await dbClient.reset();
});

afterAll(async () => {
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

describe('Train Line API', () => {
  test('should create a new train line', async () => {
    const response = await request(app)
      .post('/train-line')
      .send({
        name: '1',
        stations: ['Canal', 'Houston', 'Christopher', '14th'],
        fare: 2.75,
        commit: false,
      });
    expect(response.statusCode).toBe(201);
    expect(response.body.message).toBe('Train line was created successfully.');
  });
});

describe('Card API', () => {
  test('should create a new card and add balance', async () => {
    const response = await request(app).post('/card').send({
      number: '1234',
      amount: 10.0,
      commit: false,
    });
    expect(response.statusCode).toBe(201);
    expect(response.body.message).toBe('Card was created/updated successfully.');
    expect(parseFloat(response.body.card.balance)).toBe(10.0);
  });

  test('should add balance to an existing card', async () => {
    await request(app).post('/card').send({
      number: '12345',
      amount: 10.0,
      commit: false,
    });

    const response = await request(app).post('/card').send({
      number: '12345',
      amount: 5.0,
      commit: false,
    });
    expect(response.statusCode).toBe(201);
    expect(response.body.message).toBe('Card was created/updated successfully.');
    expect(parseFloat(response.body.card.balance)).toBe(15.0); 
  });
});

describe('Station API', () => {
  beforeEach(async () => {
    await request(app)
      .post('/train-line')
      .send({
        name: '1',
        stations: ['Canal', 'Houston', 'Christopher', '14th'],
        fare: 2.75,
        commit: false,
      });
    await request(app).post('/card').send({
      number: '12345',
      amount: 15.0,
      commit: false,
    });
  });

  test('should allow card to enter a station', async () => {
    const response = await request(app).post('/station/Houston/enter').send({
      card_number: '12345',
      commit: false,
    });
    expect(response.statusCode).toBe(200);
    expect(parseFloat(response.body.amount)).toBe(12.25); 
  });

  test('should allow card to enter a station with min fare', async () => {
    await request(app)
      .post('/train-line')
      .send({
        name: '2',
        stations: ['Canal', 'Houston', 'Christopher', '14th'],
        fare: 1,
        commit: false,
      });

    const response = await request(app).post('/station/Houston/enter').send({
      card_number: '12345',
      commit: false,
    });
    expect(response.statusCode).toBe(200);
    expect(parseFloat(response.body.amount)).toBe(14);
  });

  test('should not allow card to enter a station', async () => {
    await request(app)
      .post('/train-line')
      .send({
        name: '2',
        stations: ['1st', '2nd', '3rd', '4th'],
        fare: 100,
        commit: false,
      });

    const response = await request(app).post('/station/1st/enter').send({
      card_number: '12345',
      commit: false,
    });
    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('Insufficient prepaid balance.');
  });

  test('should allow card to exit a station without fare', async () => {
    const response = await request(app).post('/station/14th/exit').send({
      card_number: '12345',
      commit: false,
    });
    expect(response.statusCode).toBe(200);
    expect(parseFloat(response.body.amount)).toBe(15); 
  });
});

describe('Route API', () => {
  test('already at station', async () => {
    await request(app)
      .post('/train-line')
      .send({
        name: '1',
        stations: ['Canal', 'Houston', 'Christopher'],
        fare: 2.75,
        commit: false,
      });

    const response = await request(app).get('/route').query({
      origin: 'Canal',
      destination: 'Canal',
    });
    expect(response.statusCode).toBe(200);
    expect(response.body.route).toEqual(['Canal']);
  });

  test('should return the optimal route, no transfers', async () => {
    await request(app)
      .post('/train-line')
      .send({
        name: '1',
        stations: ['Canal', 'Houston', 'Christopher', '14th'],
        fare: 2.75,
        commit: false,
      });

    const response = await request(app).get('/route').query({
      origin: 'Houston',
      destination: 'Christopher',
    });
    expect(response.statusCode).toBe(200);
    expect(response.body.route).toEqual(['Houston', 'Christopher']);
  });

  test('should return the optimal route, no transfers, backwards', async () => {
    await request(app)
      .post('/train-line')
      .send({
        name: '1',
        stations: ['Canal', 'Houston', 'Christopher', '14th'],
        fare: 2.75,
        commit: false,
      });

    const response = await request(app).get('/route').query({
      origin: '14th',
      destination: 'Canal',
    });
    expect(response.statusCode).toBe(200);
    expect(response.body.route).toEqual([
      '14th',
      'Christopher',
      'Houston',
      'Canal',
    ]);
  });

  test('should return the optimal route, with transfers', async () => {
    await request(app)
      .post('/train-line')
      .send({
        name: '1',
        stations: ['Canal', 'Houston', 'Christopher', '14th'],
        fare: 2.75,
        commit: false,
      });

    await request(app)
      .post('/train-line')
      .send({
        name: 'E',
        stations: ['Spring', 'West 4th', '14th', '23rd'],
        fare: 2.75,
        commit: false,
      });

    const response = await request(app).get('/route').query({
      origin: 'Houston',
      destination: '23rd',
    });
    expect(response.statusCode).toBe(200);
    expect(response.body.route).toEqual([
      'Houston',
      'Christopher',
      '14th',
      '23rd',
    ]);
  });

  test('cannot reach station', async () => {
    await request(app)
      .post('/train-line')
      .send({
        name: '1',
        stations: ['Canal', 'Houston', 'Christopher'],
        fare: 2.75,
        commit: false,
      });

    await request(app)
      .post('/train-line')
      .send({
        name: 'E',
        stations: ['Spring', 'West 4th', '14th', '23rd'],
        fare: 2.75,
        commit: false,
      });

    const response = await request(app).get('/route').query({
      origin: 'Houston',
      destination: '23rd',
    });
    expect(response.statusCode).toBe(400);
    expect(response.body.error).toEqual('No route found');
  });
});
