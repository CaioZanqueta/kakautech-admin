'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. Rename existing 'type' column to 'file_type' if it exists and is a string/varchar
      const tableInfo = await queryInterface.describeTable('tickets');
      if (tableInfo.type && tableInfo.type.type !== 'USER-DEFINED') { 
        // USER-DEFINED is enum in postgres. If not enum, rename it.
        await queryInterface.renameColumn('tickets', 'type', 'file_type', { transaction });
      }

      // 2. Create enums if they don't exist
      await queryInterface.sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE "enum_tickets_type" AS ENUM('incident', 'service_request');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
        DO $$ BEGIN
          CREATE TYPE "enum_tickets_urgency" AS ENUM('low', 'medium', 'high');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
        DO $$ BEGIN
          CREATE TYPE "enum_tickets_impact" AS ENUM('low', 'medium', 'high');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `, { transaction });

      // 3. Add new columns safely
      await queryInterface.sequelize.query(`
        ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "type" "enum_tickets_type" NOT NULL DEFAULT 'incident';
        ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "category" VARCHAR(255);
        ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "urgency" "enum_tickets_urgency" NOT NULL DEFAULT 'medium';
        ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "impact" "enum_tickets_impact" NOT NULL DEFAULT 'medium';
      `, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE "tickets" DROP COLUMN IF EXISTS "type";
        ALTER TABLE "tickets" DROP COLUMN IF EXISTS "category";
        ALTER TABLE "tickets" DROP COLUMN IF EXISTS "urgency";
        ALTER TABLE "tickets" DROP COLUMN IF EXISTS "impact";
      `, { transaction });
      
      // Rename file_type back to type
      await queryInterface.renameColumn('tickets', 'file_type', 'type', { transaction });

      await queryInterface.sequelize.query(`
        DROP TYPE IF EXISTS "enum_tickets_type";
        DROP TYPE IF EXISTS "enum_tickets_urgency";
        DROP TYPE IF EXISTS "enum_tickets_impact";
      `, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
