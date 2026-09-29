import mongoose, { type ClientSession } from 'mongoose';

const withDatabaseTransaction = async <T>(
  operation: (session: ClientSession) => Promise<T>,
): Promise<T> => mongoose.connection.transaction(operation);

export { withDatabaseTransaction };
