import mongoose from 'mongoose';

const opts = { strict: false, timestamps: true };

const collectionMap = {
  User: 'users',
  Employee: 'employees',
  PC: 'pcs',
  Part: 'parts',
  NetworkInfo: 'network_info',
  TransferLog: 'transfer_logs',
  PlannedBuild: 'planned_builds',
  PlannedBuildItem: 'planned_build_items',
  BuildComment: 'build_comments',
};

const models = {};

for (const [name, collection] of Object.entries(collectionMap)) {
  models[name] = mongoose.model(name, new mongoose.Schema({}, opts), collection);
}

export const { User, Employee, PC, Part, NetworkInfo, TransferLog, PlannedBuild, PlannedBuildItem, BuildComment } = models;
