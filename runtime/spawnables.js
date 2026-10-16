/** `ctx.spawnables`: named templates for what the game creates while it runs. */
export class GameSpawnables {
  definitions = new Map();

  constructor(getContext) {
    this.getContext = getContext;
  }

  define(name, create, options = {}) {
    if (typeof create !== "function") {
      throw new Error(`spawnables.define("${name}") needs a create function.`);
    }
    this.definitions.set(name, { create, description: options.description });
  }

  has(name) {
    return this.definitions.has(name);
  }

  names() {
    return [...this.definitions.keys()];
  }

  spawn(name, params = {}) {
    const definition = this.definitions.get(name);
    if (definition === undefined) {
      throw new Error(`No spawnable named "${name}" is defined.`);
    }
    const object = definition.create(this.getContext(), params);
    if (!object || object.isObject3D !== true) {
      throw new Error(`Spawnable "${name}" did not return a THREE.Object3D.`);
    }
    if (!object.name) object.name = name;
    object.userData.spawnable = name;
    return object;
  }
}
