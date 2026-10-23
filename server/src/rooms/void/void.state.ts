import { Schema, MapSchema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") name = "";
  @type("string") look = "";
  @type("number") x = 0;
  @type("number") y = 0;
}

export class VoidState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}
