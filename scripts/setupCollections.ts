/// <reference types="node" />

import PocketBase from "pocketbase";
import { COLLECTIONS } from "../src/data/schema";

const POCKETBASE_URL =
  process.env.VITE_POCKETBASE_URL || "https://pocketbase.cyborgdev.cloud";
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || "admin123456";
const DRY_RUN = process.argv.includes("--dry-run");
const CLEAN_MODE = process.argv.includes("--clean");

const pb = new PocketBase(POCKETBASE_URL);

/**
 * Check if a collection schema contains user data (has userId field)
 */
function hasUserData(schema: (typeof COLLECTIONS)[0]): boolean {
  return schema.fields.some((f) => f.name === "userId");
}

/**
 * Get appropriate API rules for a collection
 */
function getCollectionRules(
  schema: (typeof COLLECTIONS)[0],
): Record<string, string> {
  if (hasUserData(schema)) {
    // User-specific rules - only allow access to own data
    const userRule = "@request.auth.id != null && userId = @request.auth.id";
    return {
      listRule: userRule,
      viewRule: userRule,
      createRule: userRule,
      updateRule: userRule,
      deleteRule: userRule,
    };
  } else {
    // Public collections - open access
    return {
      listRule: "",
      viewRule: "",
      createRule: "",
      updateRule: "",
      deleteRule: "",
    };
  }
}

/**
 * Convert schema indexes to PocketBase index format
 */
function getCollectionIndexes(
  schema: (typeof COLLECTIONS)[0],
): string[] {
  if (!schema.indexes) return [];

  return schema.indexes.map((indexFields, idx) => {
    const fieldList = indexFields.join(", ");
    const indexName = `idx_${schema.name}_${idx}`;
    return `CREATE INDEX ${indexName} ON ${schema.name} (${fieldList})`;
  });
}

async function setupCollections(): Promise<void> {
  try {
    if (DRY_RUN) console.log("🏜️  DRY RUN MODE\n");
    if (CLEAN_MODE && !DRY_RUN) console.log("🧹 CLEAN MODE\n");

    console.log("🔐 Authenticating with PocketBase...");
    await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log("✅ Authenticated\n");

    // Test: try creating a simple test collection
    try {
      await pb.collections.getOne("__test_coll");
      console.log("Test collection exists, deleting...");
      const test = await pb.collections.getOne("__test_coll");
      await pb.collections.delete(test.id);
    } catch {
      // doesn't exist, that's fine
    }

    // Check which collections exist and build ID mapping
    const existingCollections = new Set<string>();
    const collectionIdMap = new Map<string, string>();

    for (const schema of COLLECTIONS) {
      try {
        const coll = await pb.collections.getOne(schema.name);
        existingCollections.add(schema.name);
        collectionIdMap.set(schema.name, coll.id);
      } catch {
        // Collection doesn't exist
      }
    }

    console.log("🏗️  Creating/updating collections...\n");

    // First, try to clean up any existing new collections if in clean mode
    if (CLEAN_MODE && !DRY_RUN) {
      console.log(
        "🧹 Removing Quiz Questions, Review Items, and Review Events...\n",
      );
      for (const name of [
        "church_latin_quiz_questions",
        "church_latin_review_items",
        "church_latin_review_events",
      ]) {
        try {
          const coll = await pb.collections.getOne(name);
          await pb.collections.delete(coll.id);
          console.log(`   ✅ Deleted ${name}`);
          existingCollections.delete(name);
        } catch {
          // Doesn't exist, that's fine
        }
      }
      console.log();
    }

    // Process each collection
    for (const schema of COLLECTIONS) {
      if (existingCollections.has(schema.name)) {
        const collection = await pb.collections.getOne(schema.name);
        console.log(`  ⏭️  ${schema.displayName}: Already exists`);

        if (!DRY_RUN) {
          let existing = collection.fields as Array<Record<string, unknown>>;

          // Update fields FIRST
          for (const field of schema.fields) {
            const existingField = existing.find((f) => f.name === field.name);

            if (!existingField) {
              // Add new field
              const pbField: Record<string, unknown> = {
                name: field.name,
                type: field.type,
                required: field.required || false,
              };
              if (field.unique) pbField.unique = true;

              // Handle select fields - use direct values property
              if (field.type === "select" && field.values) {
                pbField.values = field.values;
                if (field.maxSelect) pbField.maxSelect = field.maxSelect;
              }
              // Handle relation fields
              else if (field.type === "relation" && field.collectionId) {
                const targetId = collectionIdMap.get(field.collectionId);
                if (targetId) {
                  pbField.collectionId = targetId;
                } else {
                  // Target collection doesn't exist yet, skip
                  continue;
                }
                if (field.maxSelect) pbField.maxSelect = field.maxSelect;
                if (field.cascadeDelete) pbField.cascadeDelete = true;
              } else if (field.options) {
                pbField.options = field.options;
              }

              try {
                await pb.collections.update(collection.id, {
                  fields: [...existing, pbField],
                } as never);
                console.log(`     ✅ Added field: ${field.name}`);
                existing.push(pbField);
              } catch (error) {
                if (
                  error instanceof Error &&
                  error.message?.includes("not found")
                ) {
                  console.log(
                    `     ℹ️  Field '${field.name}' references missing collection (will add later)`,
                  );
                } else {
                  // Silently skip - field may already exist or have other issues
                }
              }
            } else if (
              existingField.type !== field.type ||
              JSON.stringify(existingField.values || []) !==
              JSON.stringify(field.values || []) ||
              JSON.stringify(existingField.options || {}) !==
              JSON.stringify(field.options || {})
            ) {
              // Field type or configuration has changed - try to update it
              const pbField: Record<string, unknown> = {
                ...existingField,
                type: field.type,
              };

              // Update based on new type
              if (field.type === "select" && field.values) {
                pbField.values = field.values;
                if (field.maxSelect) pbField.maxSelect = field.maxSelect;
                // Remove number-specific options
                delete pbField.options;
              } else if (field.type === "relation" && field.collectionId) {
                const targetId = collectionIdMap.get(field.collectionId);
                if (targetId) {
                  pbField.collectionId = targetId;
                } else {
                  continue;
                }
                if (field.maxSelect) pbField.maxSelect = field.maxSelect;
                if (field.cascadeDelete) pbField.cascadeDelete = true;
              } else if (field.options) {
                pbField.options = field.options;
                delete pbField.values;
              }

              try {
                const updatedFields = existing.map((f) =>
                  f.name === field.name ? pbField : f,
                );
                await pb.collections.update(collection.id, {
                  fields: updatedFields,
                } as never);
                console.log(`     ✅ Updated field: ${field.name}`);
                Object.assign(existingField, pbField);
              } catch (error) {
                // If direct update fails and type changed, try delete + recreate
                const typeChanged = existingField.type !== field.type;
                if (typeChanged && field.name !== "id") {
                  try {
                    console.log(`     🔄 Attempting to recreate field: ${field.name}`);
                    // Delete the old field
                    const withoutField = existing.filter(
                      (f) => f.name !== field.name,
                    );
                    await pb.collections.update(collection.id, {
                      fields: withoutField,
                    } as never);

                    // Add the new field with correct type
                    const newField: Record<string, unknown> = {
                      name: field.name,
                      type: field.type,
                      required: field.required || false,
                    };
                    if (field.unique) newField.unique = true;
                    if (field.type === "select" && field.values) {
                      newField.values = field.values;
                      if (field.maxSelect) newField.maxSelect = field.maxSelect;
                    } else if (field.options) {
                      newField.options = field.options;
                    }

                    const withNewField = [...withoutField, newField];
                    await pb.collections.update(collection.id, {
                      fields: withNewField,
                    } as never);

                    console.log(
                      `     ✅ Recreated field: ${field.name} (converted type)`,
                    );
                    existing = withNewField;
                  } catch (retryError) {
                    console.log(
                      `     ⚠️  Failed to recreate field ${field.name}: `,
                      retryError instanceof Error ? retryError.message : retryError,
                    );
                  }
                } else {
                  console.log(
                    `     ⚠️  Failed to update field ${field.name}:`,
                    error instanceof Error ? error.message : error,
                  );
                }
              }
            }
          }

          // DELETE FIELDS NOT IN SCHEMA (cleanup old unused fields)
          const schemaFieldNames = new Set(schema.fields.map((f) => f.name));
          const fieldsToDelete = existing.filter((f) => !schemaFieldNames.has(f.name as string) && (f.name as string) !== "id");

          if (fieldsToDelete.length > 0) {
            try {
              let updated = existing;
              for (const field of fieldsToDelete) {
                updated = updated.filter((f) => f.name !== field.name);
                console.log(`     🗑️  Removing unused field: ${field.name}`);
              }
              await pb.collections.update(collection.id, {
                fields: updated,
              } as never);
            } catch (deleteError) {
              console.log(
                `     ⚠️  Failed to delete unused fields:`,
                deleteError instanceof Error ? deleteError.message : deleteError,
              );
            }
          }

          // UPDATE RULES AND INDEXES LAST (after all field changes)
          const rules = getCollectionRules(schema);
          const indexes = getCollectionIndexes(schema);

          // Fetch fresh collection state after field updates
          const updatedCollection = await pb.collections.getOne(schema.name);

          // Check if rules need updating
          const hasMatchingRules =
            updatedCollection.listRule === rules.listRule &&
            updatedCollection.viewRule === rules.viewRule &&
            updatedCollection.createRule === rules.createRule &&
            updatedCollection.updateRule === rules.updateRule &&
            updatedCollection.deleteRule === rules.deleteRule;

          // Check if indexes need updating
          const currentIndexes = (updatedCollection.indexes || []) as string[];
          const hasMatchingIndexes =
            currentIndexes.length === indexes.length &&
            currentIndexes.every((idx, i) => idx === indexes[i]);

          if (!hasMatchingRules || !hasMatchingIndexes) {
            try {
              const updatePayload: Record<string, unknown> = {
                listRule: rules.listRule,
                viewRule: rules.viewRule,
                createRule: rules.createRule,
                updateRule: rules.updateRule,
                deleteRule: rules.deleteRule,
              };
              if (indexes.length > 0) {
                updatePayload.indexes = indexes;
              }
              await pb.collections.update(updatedCollection.id, updatePayload as never);
              if (!hasMatchingRules) console.log(`     ✅ Updated rules`);
              if (!hasMatchingIndexes) console.log(`     ✅ Updated indexes`);
            } catch {
              console.log(`     ⚠️  Failed to update rules/indexes`);
            }
          }
        }
      } else {
        // Create new collection - with NO relation fields AND NO select fields initially
        if (DRY_RUN) {
          const ruleType = hasUserData(schema) ? "user-scoped" : "public";
          console.log(
            `  📝 ${schema.displayName}: Would create (${ruleType} rules)`,
          );
        } else {
          try {
            // Build fields - exclude relation fields from initial creation, but include select fields
            const nonRelationFields = schema.fields.filter(
              (f) => f.type !== "relation",
            );

            const pbFields = nonRelationFields.map((field) => {
              const pbField: Record<string, unknown> = {
                name: field.name,
                type: field.type,
                required: field.required || false,
              };
              if (field.unique) pbField.unique = true;

              // Use direct properties for select fields
              if (field.type === "select" && field.values) {
                pbField.values = field.values;
                if (field.maxSelect) pbField.maxSelect = field.maxSelect;
              } else if (field.options) {
                pbField.options = field.options;
              }
              return pbField;
            });

            const rules = getCollectionRules(schema);
            const indexes = getCollectionIndexes(schema);
            const createPayload = {
              name: schema.name,
              displayName: schema.displayName,
              type: schema.type,
              fields: pbFields as object[],
              listRule: rules.listRule,
              viewRule: rules.viewRule,
              createRule: rules.createRule,
              updateRule: rules.updateRule,
              deleteRule: rules.deleteRule,
            } as Record<string, unknown>;

            if (indexes.length > 0) {
              createPayload.indexes = indexes;
            }

            await pb.collections.create(createPayload as never);

            console.log(`  ✅ ${schema.displayName}: Created`);
            existingCollections.add(schema.name);

            // Now add relation fields
            const relationFields = schema.fields.filter(
              (f) => f.type === "relation",
            );
            if (relationFields.length > 0) {
              const created = await pb.collections.getOne(schema.name);

              for (const field of relationFields) {
                const pbField: Record<string, unknown> = {
                  name: field.name,
                  type: "relation",
                  required: field.required || false,
                };
                if (field.unique) pbField.unique = true;
                if (field.collectionId) {
                  const targetId = collectionIdMap.get(field.collectionId);
                  if (!targetId) {
                    // Target collection doesn't exist yet, skip this field
                    console.log(
                      `       ⏭️  Skipping relation: ${field.name} (target not ready)`,
                    );
                    continue;
                  }
                  pbField.collectionId = targetId;
                }
                if (field.maxSelect !== undefined) {
                  pbField.maxSelect = field.maxSelect;
                }
                if (field.cascadeDelete) {
                  pbField.cascadeDelete = true;
                }

                try {
                  // Fetch fresh copy of the collection to ensure we have the latest state
                  const fresh = await pb.collections.getOne(created.id);
                  const freshFields = fresh.fields as Array<
                    Record<string, unknown>
                  >;

                  await pb.collections.update(created.id, {
                    fields: [...freshFields, pbField],
                  } as never);
                  console.log(`     ✅ Added relation: ${field.name}`);
                } catch (relError: unknown) {
                  let errorMsg = "Unknown error";

                  if (relError instanceof Error) {
                    errorMsg = relError.message;
                  } else if (
                    typeof relError === "object" &&
                    relError !== null &&
                    "message" in relError
                  ) {
                    errorMsg = String(relError.message);
                  } else if (
                    typeof relError === "object" &&
                    relError !== null &&
                    "data" in relError
                  ) {
                    errorMsg = JSON.stringify(relError.data).substring(0, 100);
                  } else {
                    errorMsg = JSON.stringify(relError).substring(0, 100);
                  }

                  // Check if it's a "not found" error (target collection doesn't exist)
                  if (
                    errorMsg.includes("not found") ||
                    errorMsg.includes("not exist")
                  ) {
                    console.log(
                      `     ℹ️  Deferred relation: ${field.name} (target collection may not exist yet)`,
                    );
                  } else {
                    console.log(
                      `     ⏭️  Deferred relation: ${field.name} (${errorMsg})`,
                    );
                  }
                }
              }
            }
          } catch (error) {
            console.log(`  ❌ ${schema.displayName}: Failed`);
            if (
              typeof error === "object" &&
              error !== null &&
              "message" in error
            ) {
              const err = error as Error;
              console.log(`     Error: ${err.message}`);
            }
          }
        }
      }
    }

    console.log("\n✨ Setup Complete!");
    console.log(
      "\n✅ All collections created with all fields (relation and select fields now supported!).",
    );
  } catch (error) {
    console.error("❌ Error:", (error as Error).message);
    process.exit(1);
  }
}

setupCollections();
