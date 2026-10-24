import { Schema, MapSchema, type } from "@colyseus/schema";

export class Player extends Schema {
  // Lets the client match a player to the member list (online or not).
  @type("string") userId = "";
  @type("string") name = "";
  @type("string") look = "";
  @type("number") x = 0;
  @type("number") y = 0;
  // The seat this player sits on ("" when standing) and the way they face there.
  @type("string") seat = "";
  @type("string") facing = "";
  // The id of the meeting room they stand in ("" outside all of them); set by the server only.
  @type("string") zone = "";
}

export class TableClaim extends Schema {
  @type("string") userId = "";
  @type("string") name = "";
}

export class Furniture extends Schema {
  @type("string") itemId = "";
  @type("number") col = 0;
  @type("number") row = 0;
}

export class VoidState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  // Keyed by the table's id from the map.
  @type({ map: TableClaim }) tables = new MapSchema<TableClaim>();
  // Keyed by the piece's id; placed by owners and admins.
  @type({ map: Furniture }) furniture = new MapSchema<Furniture>();
}
