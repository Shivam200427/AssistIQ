import { MongoMemoryServer } from "mongodb-memory-server";

// A throwaway in-memory MongoDB for the whole test run. Tests never touch the real database.
let mongod: MongoMemoryServer;

export async function setup({ provide }: any) {
  mongod = await MongoMemoryServer.create();
  provide("mongoUri", mongod.getUri("assistiq-test"));
}

export async function teardown() {
  await mongod?.stop();
}

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
