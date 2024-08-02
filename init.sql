CREATE TABLE train_line (
    "id"                  serial              primary key,
    "name"                text                unique not null
);

CREATE TABLE station (
    "id"                  serial              primary key,
    "name"                text                unique not null
);

CREATE TABLE connection (
    "id"                  serial              primary key,
    "train_line_id"       integer             references train_line("id") not null,
    "station1_id"         integer             references station("id") not null,
    "station2_id"         integer             references station("id") not null,

    UNIQUE ("train_line_id", "station1_id", "station2_id")
);

ALTER TABLE train_line ADD COLUMN
     "fare"               decimal(10, 2)       CHECK ("fare" > 0) null;


CREATE TABLE card (
    "id"                  serial              primary key,
    "number"              text                unique not null,
    "balance"             decimal(10, 2)      CHECK ("balance" >= 0) not null
);


CREATE TABLE ride (
  "id"                    serial              primary key,
  "card_number"           text                references card("number") not null,
  "station"               text                references station("name") NOT null,
  "action"                varchar(10)         check (action in ('enter', 'exit')) not null,
  "created_at"            timestamp           default current_timestamp not null,
  "fare"                  decimal(10, 2)
);
