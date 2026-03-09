-- | CINeMA Exchange Schema v2 types
-- |
-- | These types mirror cinema_schema_v2.json and are designed for:
-- | 1. Importing pre-computed analysis results from MetaInsight or other NMA tools
-- | 2. Type-checking imported data at the boundary (decode = validation)
-- | 3. Eventually replacing the v1 CMContainer/ContributionMatrix types
-- |
-- | If a v2 JSON file has a populated analyses[] array, the R backend
-- | can be bypassed entirely.
module SchemaV2 where

import Prelude
import Data.Argonaut.Core (Json, toObject)
import Data.Argonaut.Decode.Error (JsonDecodeError(..))
import Data.Argonaut.Decode.Combinators (getField, getFieldOptional)
import Data.Argonaut.Decode.Class (class DecodeJson, decodeJson)
import Data.Argonaut.Encode.Class (class EncodeJson, encodeJson)
import Data.Either (Either(..))
import Data.Maybe (Maybe(..))
import Data.Generic.Rep as Rep
import Data.Show.Generic (genericShow)
import Data.Lens (lens)
import Data.Lens.Zoom (Lens')
import Data.Lens.Record (prop)
import Data.Symbol
import Type.Proxy (Proxy(..))
import Foreign.Object (Object)

import ComparisonModel (TreatmentId)
import EffectMeasure (EffectMeasureType)

-- =====================================================
-- StudyArm — one arm of one study (raw input data)
-- =====================================================
newtype StudyArm = StudyArm
  { study :: TreatmentId
  , id :: TreatmentId
  , treatment :: TreatmentId
  , n :: Int
  , rob :: Int
  , indirectness :: Int
  , events :: Maybe Int
  , mean :: Maybe Number
  , sd :: Maybe Number
  }

derive instance genericStudyArm :: Rep.Generic StudyArm _
instance showStudyArm :: Show StudyArm where
  show = genericShow

instance decodeStudyArm :: DecodeJson StudyArm where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      study <- getField obj "study"
      id <- getField obj "id"
      treatment <- getField obj "treatment"
      n <- getField obj "n"
      rob <- getField obj "rob"
      indirectness <- getField obj "indirectness"
      events <- getFieldOptional obj "events"
      mean <- getFieldOptional obj "mean"
      sd <- getFieldOptional obj "sd"
      pure $ StudyArm { study, id, treatment, n, rob, indirectness, events, mean, sd }

instance encodeStudyArm :: EncodeJson StudyArm where
  encodeJson (StudyArm s) = encodeJson s

_StudyArm :: Lens' StudyArm (Record _)
_StudyArm = lens (\(StudyArm s) -> s) (\_ -> StudyArm)

-- =====================================================
-- AnalysisParams — identifies one analysis
-- =====================================================
newtype AnalysisParams = AnalysisParams
  { model :: String
  , sm :: String
  , framework :: Maybe String
  , tau :: Maybe Number
  , label :: Maybe String
  }

derive instance genericAnalysisParams :: Rep.Generic AnalysisParams _
instance showAnalysisParams :: Show AnalysisParams where
  show = genericShow

instance decodeAnalysisParams :: DecodeJson AnalysisParams where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      model <- getField obj "model"
      sm <- getField obj "sm"
      framework <- getFieldOptional obj "framework"
      tau <- getFieldOptional obj "tau"
      label <- getFieldOptional obj "label"
      pure $ AnalysisParams { model, sm, framework, tau, label }

instance encodeAnalysisParams :: EncodeJson AnalysisParams where
  encodeJson (AnalysisParams p) = encodeJson p

_AnalysisParams :: Lens' AnalysisParams (Record _)
_AnalysisParams = lens (\(AnalysisParams s) -> s) (\_ -> AnalysisParams)

-- =====================================================
-- HatMatrix — the NMA projection matrix H
-- =====================================================
newtype HatMatrix = HatMatrix
  { "H" :: Array (Array Number)
  , rowNames :: Array String
  , colNames :: Array String
  }

derive instance genericHatMatrix :: Rep.Generic HatMatrix _
instance showHatMatrix :: Show HatMatrix where
  show = genericShow

instance decodeHatMatrix :: DecodeJson HatMatrix where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      h <- getField obj "H"
      rowNames <- getField obj "rowNames"
      colNames <- getField obj "colNames"
      pure $ HatMatrix { "H": h, rowNames, colNames }

instance encodeHatMatrix :: EncodeJson HatMatrix where
  encodeJson (HatMatrix m) = encodeJson m

_HatMatrix :: Lens' HatMatrix (Record _)
_HatMatrix = lens (\(HatMatrix s) -> s) (\_ -> HatMatrix)

-- =====================================================
-- DirectEstimate / IndirectEstimate — sub-objects of ComparisonResult
-- =====================================================
newtype DirectEstimate = DirectEstimate
  { effect :: Number
  , ciLower :: Number
  , ciUpper :: Number
  }

derive instance genericDirectEstimate :: Rep.Generic DirectEstimate _
instance showDirectEstimate :: Show DirectEstimate where
  show = genericShow

instance decodeDirectEstimate :: DecodeJson DirectEstimate where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      effect <- getField obj "effect"
      ciLower <- getField obj "ciLower"
      ciUpper <- getField obj "ciUpper"
      pure $ DirectEstimate { effect, ciLower, ciUpper }

instance encodeDirectEstimate :: EncodeJson DirectEstimate where
  encodeJson (DirectEstimate e) = encodeJson e

_DirectEstimate :: Lens' DirectEstimate (Record _)
_DirectEstimate = lens (\(DirectEstimate s) -> s) (\_ -> DirectEstimate)

newtype IndirectEstimate = IndirectEstimate
  { effect :: Number
  , ciLower :: Number
  , ciUpper :: Number
  }

derive instance genericIndirectEstimate :: Rep.Generic IndirectEstimate _
instance showIndirectEstimate :: Show IndirectEstimate where
  show = genericShow

instance decodeIndirectEstimate :: DecodeJson IndirectEstimate where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      effect <- getField obj "effect"
      ciLower <- getField obj "ciLower"
      ciUpper <- getField obj "ciUpper"
      pure $ IndirectEstimate { effect, ciLower, ciUpper }

instance encodeIndirectEstimate :: EncodeJson IndirectEstimate where
  encodeJson (IndirectEstimate e) = encodeJson e

_IndirectEstimate :: Lens' IndirectEstimate (Record _)
_IndirectEstimate = lens (\(IndirectEstimate s) -> s) (\_ -> IndirectEstimate)

-- =====================================================
-- IncoherenceTest — SIDE test result
-- =====================================================
newtype IncoherenceTest = IncoherenceTest
  { effect :: Number
  , ciLower :: Number
  , ciUpper :: Number
  , z :: Number
  , pvalue :: Number
  }

derive instance genericIncoherenceTest :: Rep.Generic IncoherenceTest _
instance showIncoherenceTest :: Show IncoherenceTest where
  show = genericShow

instance decodeIncoherenceTest :: DecodeJson IncoherenceTest where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      effect <- getField obj "effect"
      ciLower <- getField obj "ciLower"
      ciUpper <- getField obj "ciUpper"
      z <- getField obj "z"
      pvalue <- getField obj "pvalue"
      pure $ IncoherenceTest { effect, ciLower, ciUpper, z, pvalue }

instance encodeIncoherenceTest :: EncodeJson IncoherenceTest where
  encodeJson (IncoherenceTest t) = encodeJson t

_IncoherenceTest :: Lens' IncoherenceTest (Record _)
_IncoherenceTest = lens (\(IncoherenceTest s) -> s) (\_ -> IncoherenceTest)

-- =====================================================
-- ComparisonResult — per-comparison NMA results
-- =====================================================
newtype ComparisonResult = ComparisonResult
  { comparison :: String
  , effect :: Number
  , se :: Number
  , ciLower :: Number
  , ciUpper :: Number
  , priLower :: Number
  , priUpper :: Number
  , propDirect :: Number
  , direct :: Maybe DirectEstimate
  , indirect :: Maybe IndirectEstimate
  , incoherence :: Maybe IncoherenceTest
  }

derive instance genericComparisonResult :: Rep.Generic ComparisonResult _
instance showComparisonResult :: Show ComparisonResult where
  show = genericShow

instance decodeComparisonResult :: DecodeJson ComparisonResult where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      comparison <- getField obj "comparison"
      effect <- getField obj "effect"
      se <- getField obj "se"
      ciLower <- getField obj "ciLower"
      ciUpper <- getField obj "ciUpper"
      priLower <- getField obj "priLower"
      priUpper <- getField obj "priUpper"
      propDirect <- getField obj "propDirect"
      direct <- getFieldOptional obj "direct"
      indirect <- getFieldOptional obj "indirect"
      incoherence <- getFieldOptional obj "incoherence"
      pure $ ComparisonResult
        { comparison, effect, se, ciLower, ciUpper
        , priLower, priUpper, propDirect
        , direct, indirect, incoherence
        }

instance encodeComparisonResult :: EncodeJson ComparisonResult where
  encodeJson (ComparisonResult r) = encodeJson r

_ComparisonResult :: Lens' ComparisonResult (Record _)
_ComparisonResult = lens (\(ComparisonResult s) -> s) (\_ -> ComparisonResult)

-- =====================================================
-- PairwiseResult — per-direct-comparison heterogeneity
-- =====================================================
newtype PairwiseResult = PairwiseResult
  { comparison :: String
  , tau2 :: Number
  , "I2" :: Number
  , "I2Lower" :: Maybe Number
  , "I2Upper" :: Maybe Number
  }

derive instance genericPairwiseResult :: Rep.Generic PairwiseResult _
instance showPairwiseResult :: Show PairwiseResult where
  show = genericShow

instance decodePairwiseResult :: DecodeJson PairwiseResult where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      comparison <- getField obj "comparison"
      tau2 <- getField obj "tau2"
      i2 <- getField obj "I2"
      i2Lower <- getFieldOptional obj "I2Lower"
      i2Upper <- getFieldOptional obj "I2Upper"
      pure $ PairwiseResult { comparison, tau2, "I2": i2, "I2Lower": i2Lower, "I2Upper": i2Upper }

instance encodePairwiseResult :: EncodeJson PairwiseResult where
  encodeJson (PairwiseResult r) = encodeJson r

_PairwiseResult :: Lens' PairwiseResult (Record _)
_PairwiseResult = lens (\(PairwiseResult s) -> s) (\_ -> PairwiseResult)

-- =====================================================
-- NetworkHeterogeneity — network-level stats
-- =====================================================
newtype NetworkHeterogeneity = NetworkHeterogeneity
  { tau2 :: Number
  , "Qoverall" :: Maybe Number
  , "Qheterogeneity" :: Maybe Number
  , "Qinconsistency" :: Maybe Number
  }

derive instance genericNetworkHeterogeneity :: Rep.Generic NetworkHeterogeneity _
instance showNetworkHeterogeneity :: Show NetworkHeterogeneity where
  show = genericShow

instance decodeNetworkHeterogeneity :: DecodeJson NetworkHeterogeneity where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      tau2 <- getField obj "tau2"
      qo <- getFieldOptional obj "Qoverall"
      qh <- getFieldOptional obj "Qheterogeneity"
      qi <- getFieldOptional obj "Qinconsistency"
      pure $ NetworkHeterogeneity { tau2, "Qoverall": qo, "Qheterogeneity": qh, "Qinconsistency": qi }

instance encodeNetworkHeterogeneity :: EncodeJson NetworkHeterogeneity where
  encodeJson (NetworkHeterogeneity h) = encodeJson h

_NetworkHeterogeneity :: Lens' NetworkHeterogeneity (Record _)
_NetworkHeterogeneity = lens (\(NetworkHeterogeneity s) -> s) (\_ -> NetworkHeterogeneity)

-- =====================================================
-- DesignByTreatment — global inconsistency test
-- =====================================================
newtype DesignByTreatment = DesignByTreatment
  { "Q" :: Number
  , df :: Number
  , pvalue :: Number
  }

derive instance genericDesignByTreatment :: Rep.Generic DesignByTreatment _
instance showDesignByTreatment :: Show DesignByTreatment where
  show = genericShow

instance decodeDesignByTreatment :: DecodeJson DesignByTreatment where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      q <- getField obj "Q"
      df <- getField obj "df"
      pvalue <- getField obj "pvalue"
      pure $ DesignByTreatment { "Q": q, df, pvalue }

instance encodeDesignByTreatment :: EncodeJson DesignByTreatment where
  encodeJson (DesignByTreatment d) = encodeJson d

_DesignByTreatment :: Lens' DesignByTreatment (Record _)
_DesignByTreatment = lens (\(DesignByTreatment s) -> s) (\_ -> DesignByTreatment)

-- =====================================================
-- StudyContributions — map<comparisonId, map<studyId, percentage>>
-- Uses Foreign.Object (which is a JS object / string-keyed map)
-- =====================================================
type StudyContributions = Object (Object Number)

-- =====================================================
-- LeagueTable — square matrix of formatted strings
-- =====================================================
type LeagueTable = Array (Array String)

-- =====================================================
-- SensitivityLeagueTables — sensitivity analyses by RoB
-- =====================================================
newtype SensitivityLeagueTables = SensitivityLeagueTables
  { lowRoB :: Maybe LeagueTable
  , lowModerateRoB :: Maybe LeagueTable
  }

derive instance genericSensitivityLeagueTables :: Rep.Generic SensitivityLeagueTables _
instance showSensitivityLeagueTables :: Show SensitivityLeagueTables where
  show = genericShow

instance decodeSensitivityLeagueTables :: DecodeJson SensitivityLeagueTables where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      lowRoB <- getFieldOptional obj "lowRoB"
      lowModerateRoB <- getFieldOptional obj "lowModerateRoB"
      pure $ SensitivityLeagueTables { lowRoB, lowModerateRoB }

instance encodeSensitivityLeagueTables :: EncodeJson SensitivityLeagueTables where
  encodeJson (SensitivityLeagueTables s) = encodeJson s

_SensitivityLeagueTables :: Lens' SensitivityLeagueTables (Record _)
_SensitivityLeagueTables = lens (\(SensitivityLeagueTables s) -> s) (\_ -> SensitivityLeagueTables)

-- =====================================================
-- Analysis — one complete NMA analysis result
-- =====================================================
newtype Analysis = Analysis
  { params :: AnalysisParams
  , hatMatrix :: Maybe HatMatrix
  , nmaResults :: Array ComparisonResult
  , pairwise :: Maybe (Array PairwiseResult)
  , networkHeterogeneity :: Maybe NetworkHeterogeneity
  , designByTreatment :: Maybe DesignByTreatment
  , studyContributions :: StudyContributions
  , leagueTable :: Maybe LeagueTable
  , sensitivityLeagueTables :: Maybe SensitivityLeagueTables
  }

derive instance genericAnalysis :: Rep.Generic Analysis _
instance showAnalysis :: Show Analysis where
  show = genericShow

instance decodeAnalysis :: DecodeJson Analysis where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      params <- getField obj "params"
      hatMatrix <- getFieldOptional obj "hatMatrix"
      nmaResults <- getField obj "nmaResults"
      pairwise <- getFieldOptional obj "pairwise"
      networkHeterogeneity <- getFieldOptional obj "networkHeterogeneity"
      designByTreatment <- getFieldOptional obj "designByTreatment"
      studyContributions <- getField obj "studyContributions"
      leagueTable <- getFieldOptional obj "leagueTable"
      sensitivityLeagueTables <- getFieldOptional obj "sensitivityLeagueTables"
      pure $ Analysis
        { params, hatMatrix, nmaResults, pairwise
        , networkHeterogeneity, designByTreatment
        , studyContributions, leagueTable, sensitivityLeagueTables
        }

instance encodeAnalysis :: EncodeJson Analysis where
  encodeJson (Analysis a) = encodeJson a

_Analysis :: Lens' Analysis (Record _)
_Analysis = lens (\(Analysis s) -> s) (\_ -> Analysis)

-- =====================================================
-- ProjectV2 — the v2 project container (for import)
-- =====================================================
newtype ProjectV2 = ProjectV2
  { format :: String
  , "type" :: String
  , studies :: Array StudyArm
  , analyses :: Array Analysis
  }

derive instance genericProjectV2 :: Rep.Generic ProjectV2 _
instance showProjectV2 :: Show ProjectV2 where
  show = genericShow

instance decodeProjectV2 :: DecodeJson ProjectV2 where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      format <- getField obj "format"
      tp <- getField obj "type"
      studies <- getField obj "studies"
      analyses <- getField obj "analyses"
      pure $ ProjectV2 { format, "type": tp, studies, analyses }

instance encodeProjectV2 :: EncodeJson ProjectV2 where
  encodeJson (ProjectV2 p) = encodeJson p

_ProjectV2 :: Lens' ProjectV2 (Record _)
_ProjectV2 = lens (\(ProjectV2 s) -> s) (\_ -> ProjectV2)

-- =====================================================
-- CinemaFileV2 — top-level wrapper (the whole JSON file)
-- =====================================================
newtype CinemaFileV2 = CinemaFileV2
  { project :: ProjectV2
  }

derive instance genericCinemaFileV2 :: Rep.Generic CinemaFileV2 _
instance showCinemaFileV2 :: Show CinemaFileV2 where
  show = genericShow

instance decodeCinemaFileV2 :: DecodeJson CinemaFileV2 where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      project <- getField obj "project"
      pure $ CinemaFileV2 { project }

instance encodeCinemaFileV2 :: EncodeJson CinemaFileV2 where
  encodeJson (CinemaFileV2 f) = encodeJson f

_CinemaFileV2 :: Lens' CinemaFileV2 (Record _)
_CinemaFileV2 = lens (\(CinemaFileV2 s) -> s) (\_ -> CinemaFileV2)

-- =====================================================
-- Convenience: decode a v2 JSON file
-- =====================================================
readCinemaFileV2 :: Json -> Either String CinemaFileV2
readCinemaFileV2 json =
  case (decodeJson json :: Either JsonDecodeError CinemaFileV2) of
    Left err -> Left (show err)
    Right file -> Right file
