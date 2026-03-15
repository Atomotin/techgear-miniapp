const { buildSharedStorageModule } = require("./shared");
const { buildLocalStorageModule } = require("./local");
const { buildSupabaseStorageModule } = require("./supabase");

function createStorageRuntime(config) {
  const shared = buildSharedStorageModule(config);
  const local = buildLocalStorageModule({ ...config, ...shared });
  const supabase = buildSupabaseStorageModule({ ...config, ...shared });

  const storage = config.supabaseEnabled
    ? supabase.createSupabaseStorageProvider()
    : local.createLocalStorageProvider();

  return {
    storage,
    ensureDataFiles: shared.ensureDataFiles,
    uploadBinaryToSupabaseStorage: supabase.uploadBinaryToSupabaseStorage
  };
}

module.exports = {
  createStorageRuntime
};
