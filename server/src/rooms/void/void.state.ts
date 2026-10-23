import { Schema, MapSchema, type } from "@colyseus/schema";

export class Player extends Schema {
  // Lets the client match a player to the member list (online or not).
  @type("string") userId = "";
  @type("string") name = "";
  @type("string") look = "";
  @type("number") x = 0;
  @type("number") y = 0;
}

export class TableClaim extends Schema {
  @type("string") userId = "";
  @type("string") name = "";
}

export class VoidState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  // Keyed by the table's id from the map.
  @type({ map: TableClaim }) tables = new MapSchema<TableClaim>();
}
