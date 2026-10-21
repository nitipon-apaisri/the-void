import { Schema, MapSchema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") name = "";
  @type("number") avatar = 0;
  @type("number") x = 0;
  @type("number") y = 0;
}

export class VoidState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}
