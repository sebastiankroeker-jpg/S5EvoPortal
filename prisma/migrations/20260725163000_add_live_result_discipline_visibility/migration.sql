ALTER TABLE "competitions"
ADD COLUMN "liveResultsDisciplines" JSONB NOT NULL DEFAULT '["RUN","BENCH","STOCK"]';
