
# Subway system challenge

This project contains the Subway System API desribed in part 1 & 2 of the challenge, designed to manage train lines, stations, connections, and card transactions. 

## Prerequisites
- [Docker](https://www.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)

## Setup Instructions

### 1. Start the app with Docker Compose

Ensure Docker is installed and configured. Then, start the application with:

```sh
docker-compose up -d
```

This command will build the Docker images and start the services defined in the `docker-compose.yml` file.

### 2. Access the API
The server will start on port 3000 by default. You can access the API at `http://localhost:3000`.

## Endpoints

### Train Line 

#### Create/update a Train Line

```http
POST /train-line
```

**Request Body:**

```json
{
  "name": "1",
  "stations": ["Canal", "Houston", "Christopher", "14th"],
  "fare": 2.75
}
```

**Example `curl` command:**

```sh
curl -X POST http://localhost:3000/train-line -H "Content-Type: application/json" -d '{
  "name": "1",
  "stations": ["Canal", "Houston", "Christopher", "14th"],
  "fare": 2.75
}'
```

### Card Management 

#### Create/update a Card

```http
POST /card
```

**Request Body:**

```json
{
  "number": "12345",
  "amount": 10.0
}
```

**Example `curl` command:**

```sh
curl -X POST http://localhost:3000/card -H "Content-Type: application/json" -d '{
  "number": "12345",
  "amount": 10.0
}'
```

#### Enter a station

```http
POST /station/:station/enter
```

**Request Body:**

```json
{
  "card_number": "12345"
}
```

**Example `curl` command:**

```sh
curl -X POST http://localhost:3000/station/Houston/enter -H "Content-Type: application/json" -d '{
  "card_number": "12345"
}'
```

#### Exit a station

```http
POST /station/:station/exit
```

**Request Body:**

```json
{
  "card_number": "12345"
}
```

**Example `curl` command:**

```sh
curl -X POST http://localhost:3000/station/Houston/exit -H "Content-Type: application/json" -d '{
  "card_number": "12345"
}'
```

### Route Finding

#### Get Route

```http
GET /route
```

**Query Parameters:**

```http
?origin=Canal&destination=14th
```

**Example `curl` command:**

```sh
curl "http://localhost:3000/route?origin=Houston&destination=Christopher"
```

## Running Tests

A set of integration tests are available under [tests/api.test.js](./tests/api.test.js). To run these tests, you should have npm configured. Follow these steps:

1. Install the necessary dependencies:

    ```sh
    npm install
    ```

2. Run the tests:

    ```sh
    npm test
    ```

These tests cover various API functionalities, including creating train lines, card transactions, and finding routes. Ensure that your Docker containers are running before executing the tests.

## Code Structure

- `api.js`: Contains the main API logic and endpoint definitions.
- `dbClient.js`: Handles database interactions using Knex.js.
- `api.test.js`: Contains test cases for the API endpoints.


## Testing

The solution was tested using jest in `api.test.js` and manual testing. The tests cover the creation of train lines, card transactions, and route finding to ensure the application works as expected.

## Conclusion & Next Steps
The APIs and data schemas were designed with the assumption that a train line is a relatively simple model, with a low number of trains and connections. For instance, the NYC metro system has around 36 lines and 472 stations. Additionally, since each user holds a single physical card, simultaneous charging of the same card is not a concern.

### Small Experiemnt
To test this, I created two short scripts under `simulations` - one to create a bunch of cards and another to have them all enter a station around the same time. I checked the database and confirmed that all the cards were created and all the ride logs were processed.


For a more advanced train system, a graph database can be considered in addition to transaction retry functionality and more.

With additional time, I'd like to:

1. Add better input validation using a library like Joi.js.
2. Implement unit tests with a mocked PostgreSQL client.
3. Enhance error handling.
4. Address enter/exit dependency issues such as exiting a station without entering or vice versa.
5. Test and support more complex use-cases.
