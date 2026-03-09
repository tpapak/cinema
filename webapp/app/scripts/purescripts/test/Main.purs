module Test.Main where

import Prelude

import Data.Array (length) as Array
import Data.Argonaut.Core (stringify)
import Data.Argonaut.Decode.Class (decodeJson)
import Data.Argonaut.Encode.Class (encodeJson)
import Data.Either (Either(..), isRight)
import Data.Maybe (Maybe(..), isJust, isNothing)
import Effect (Effect)
import Effect.Aff (launchAff_)
import Effect.Class (liftEffect)
import Foreign.Object (size, lookup) as FO
import Test.Spec (describe, it)
import Test.Spec.Assertions (shouldEqual, shouldSatisfy, fail)
import Test.Spec.Reporter.Console (consoleReporter)
import Test.Spec.Runner.Node (runSpecAndExitProcess)

import ComparisonModel
  ( TreatmentId(..)
  , Comparison
  , Node
  , InterventionType
  , _Comparison
  , _Node
  , treatmentIdToString
  , stringToTreatmentId
  , stringToComparison
  )
import EffectMeasure (EffectMeasureType(..), readEffectMeasureType)
import Model
  ( State
  , Project
  , Studies
  , CMContainer
  , ContributionMatrix
  , CMParameters
  , readState
  , _State
  , _Project
  , _CMContainer
  , _ContributionMatrix
  , _CMParameters
  , _Studies
  )
import SchemaV2
  ( StudyArm, _StudyArm
  , AnalysisParams, _AnalysisParams
  , HatMatrix, _HatMatrix
  , ComparisonResult, _ComparisonResult
  , DirectEstimate, _DirectEstimate
  , IndirectEstimate, _IndirectEstimate
  , IncoherenceTest, _IncoherenceTest
  , PairwiseResult, _PairwiseResult
  , NetworkHeterogeneity, _NetworkHeterogeneity
  , DesignByTreatment, _DesignByTreatment
  , SensitivityLeagueTables
  , Analysis, _Analysis
  , ProjectV2, _ProjectV2
  , CinemaFileV2, _CinemaFileV2
  , readCinemaFileV2
  )
import Data.Lens ((^.))
import Test.ReadFixture (readFixture)

main :: Effect Unit
main = runSpecAndExitProcess [consoleReporter] do

  -- =========================================================
  -- TreatmentId
  -- =========================================================
  describe "TreatmentId" do

    it "decodes a string treatment id" do
      json <- liftEffect $ readFixture "treatmentIdString"
      let result = decodeJson json :: Either _ TreatmentId
      result `shouldSatisfy` isRight
      case result of
        Right (StringId s) -> s `shouldEqual` "ACE"
        Right (IntId _) -> fail "Expected StringId, got IntId"
        Left err -> fail $ show err

    it "decodes an integer treatment id" do
      json <- liftEffect $ readFixture "treatmentIdInt"
      let result = decodeJson json :: Either _ TreatmentId
      result `shouldSatisfy` isRight
      case result of
        Right (IntId i) -> i `shouldEqual` 1
        Right (StringId _) -> fail "Expected IntId, got StringId"
        Left err -> fail $ show err

    it "decodes a numeric string as IntId" do
      json <- liftEffect $ readFixture "treatmentIdNumStr"
      let result = decodeJson json :: Either _ TreatmentId
      result `shouldSatisfy` isRight
      case result of
        Right (IntId i) -> i `shouldEqual` 42
        Right (StringId s) -> fail $ "Expected IntId, got StringId " <> s
        Left err -> fail $ show err

    it "treatmentIdToString round-trips" do
      let tid1 = StringId "ACE"
      treatmentIdToString tid1 `shouldEqual` "ACE"
      let tid2 = IntId 42
      treatmentIdToString tid2 `shouldEqual` "42"

    it "stringToTreatmentId parses strings" do
      let tid1 = stringToTreatmentId "ACE"
      case tid1 of
        StringId s -> s `shouldEqual` "ACE"
        IntId _ -> fail "Expected StringId for 'ACE'"

    it "stringToTreatmentId parses numeric strings" do
      let tid2 = stringToTreatmentId "42"
      case tid2 of
        IntId i -> i `shouldEqual` 42
        StringId _ -> fail "Expected IntId for '42'"

    it "encodes StringId to JSON string" do
      let tid = StringId "ACE"
      let json = encodeJson tid
      stringify json `shouldEqual` "\"ACE\""

    it "encodes IntId to JSON integer" do
      let tid = IntId 42
      let json = encodeJson tid
      stringify json `shouldEqual` "42"

  -- =========================================================
  -- EffectMeasureType
  -- =========================================================
  describe "EffectMeasureType" do

    it "decodes RD" do
      json <- liftEffect $ readFixture "effectMeasureRD"
      let result = readEffectMeasureType json
      result `shouldSatisfy` isRight
      case result of
        Right em -> show em `shouldEqual` "RD"
        Left _ -> fail "decode failed"

    it "decodes OR" do
      json <- liftEffect $ readFixture "effectMeasureOR"
      let result = readEffectMeasureType json
      result `shouldSatisfy` isRight
      case result of
        Right em -> show em `shouldEqual` "OR"
        Left _ -> fail "decode failed"

    it "decodes all valid types from inline JSON" do
      let check s expected = do
            let result = decodeJson (encodeJson s) :: Either _ EffectMeasureType
            case result of
              Right em -> show em `shouldEqual` expected
              Left err -> fail $ "Failed to decode " <> s <> ": " <> show err
      check "RR" "RR"
      check "OR" "OR"
      check "RD" "RD"
      check "MD" "MD"
      check "SMD" "SMD"

    it "rejects invalid effect measure type" do
      let result = decodeJson (encodeJson "INVALID") :: Either _ EffectMeasureType
      result `shouldSatisfy` (not <<< isRight)

  -- =========================================================
  -- Comparison
  -- =========================================================
  describe "Comparison" do

    it "decodes a comparison from fixture" do
      json <- liftEffect $ readFixture "comparison"
      let result = decodeJson json :: Either _ Comparison
      result `shouldSatisfy` isRight
      case result of
        Right comp -> do
          let rec = comp ^. _Comparison
          rec."id" `shouldEqual` "ACE,BBlocker"
          rec."numStudies" `shouldEqual` 3
          treatmentIdToString rec."t1" `shouldEqual` "ACE"
          treatmentIdToString rec."t2" `shouldEqual` "BBlocker"
        Left err -> fail $ show err

    it "stringToComparison parses colon-delimited id" do
      let comp = stringToComparison ":" "ACE:BBlocker"
      let rec = comp ^. _Comparison
      treatmentIdToString rec."t1" `shouldEqual` "ACE"
      treatmentIdToString rec."t2" `shouldEqual` "BBlocker"

    it "stringToComparison normalizes order (lower first)" do
      let comp = stringToComparison ":" "BBlocker:ACE"
      let rec = comp ^. _Comparison
      -- ACE < BBlocker alphabetically, so t1 should be ACE
      treatmentIdToString rec."t1" `shouldEqual` "ACE"
      treatmentIdToString rec."t2" `shouldEqual` "BBlocker"

  -- =========================================================
  -- Node
  -- =========================================================
  describe "Node" do

    it "decodes a node with string id" do
      json <- liftEffect $ readFixture "node"
      let result = decodeJson json :: Either _ Node
      result `shouldSatisfy` isRight
      case result of
        Right node -> do
          let rec = node ^. _Node
          treatmentIdToString rec."id" `shouldEqual` "ACE"
          rec."label" `shouldEqual` "ACE"
          rec."numStudies" `shouldEqual` 8
          rec."sampleSize" `shouldEqual` 23351
        Left err -> fail $ show err

    it "decodes a node with integer id" do
      json <- liftEffect $ readFixture "nodeIntId"
      let result = decodeJson json :: Either _ Node
      result `shouldSatisfy` isRight
      case result of
        Right node -> do
          let rec = node ^. _Node
          treatmentIdToString rec."id" `shouldEqual` "1"
          rec."numStudies" `shouldEqual` 5
          rec."sampleSize" `shouldEqual` 1000
        Left err -> fail $ show err

    it "decodes a node with interventionType array" do
      json <- liftEffect $ readFixture "nodeWithIntervention"
      let result = decodeJson json :: Either _ Node
      result `shouldSatisfy` isRight

  -- =========================================================
  -- CMParameters
  -- =========================================================
  describe "CMParameters" do

    it "decodes params from fixture" do
      json <- liftEffect $ readFixture "cmParams"
      let result = decodeJson json :: Either _ CMParameters
      result `shouldSatisfy` isRight
      case result of
        Right params -> do
          let rec = params ^. _CMParameters
          rec."MAModel" `shouldEqual` "fixed"
          rec."rule" `shouldEqual` "every"
          show rec."sm" `shouldEqual` "RD"
        Left err -> fail $ show err

  -- =========================================================
  -- ContributionMatrix
  -- =========================================================
  describe "ContributionMatrix" do

    it "decodes contribution matrix from fixture" do
      json <- liftEffect $ readFixture "contributionMatrix"
      let result = decodeJson json :: Either _ ContributionMatrix
      result `shouldSatisfy` isRight
      case result of
        Right cm -> do
          let rec = cm ^. _ContributionMatrix
          rec."status" `shouldEqual` "ready"
        Left err -> fail $ show err

  -- =========================================================
  -- CMContainer
  -- =========================================================
  describe "CMContainer" do

    it "decodes CM container from fixture" do
      json <- liftEffect $ readFixture "cmContainer"
      let result = decodeJson json :: Either _ CMContainer
      result `shouldSatisfy` isRight
      case result of
        Right container -> do
          let cm = container ^. _CMContainer
          let cmrec = cm."currentCM" ^. _ContributionMatrix
          cmrec."status" `shouldEqual` "ready"
        Left err -> fail $ show err

  -- =========================================================
  -- Studies
  -- =========================================================
  describe "Studies" do

    it "decodes studies from fixture" do
      json <- liftEffect $ readFixture "studies"
      let result = decodeJson json :: Either _ Studies
      result `shouldSatisfy` isRight

  -- =========================================================
  -- Project
  -- =========================================================
  describe "Project" do

    it "decodes project from fixture" do
      json <- liftEffect $ readFixture "project"
      let result = decodeJson json :: Either _ Project
      result `shouldSatisfy` isRight
      case result of
        Right proj -> do
          let rec = proj ^. _Project
          rec."title" `shouldEqual` "Test Diabetes"
          rec."format" `shouldEqual` "long"
          rec."type" `shouldEqual` "binary"
        Left err -> fail $ show err

  -- =========================================================
  -- State (full round-trip)
  -- =========================================================
  describe "State" do

    it "decodes full state from fixture" do
      json <- liftEffect $ readFixture "state"
      let result = readState json
      case result of
        Right state -> do
          let rec = state ^. _State
          let projRec = rec."project" ^. _Project
          projRec."title" `shouldEqual` "Test Diabetes"
          projRec."format" `shouldEqual` "long"
        Left err -> fail $ "State decode failed: " <> err

  -- =========================================================
  -- Schema V2: StudyArm
  -- =========================================================
  describe "V2 StudyArm" do

    it "decodes a binary study arm" do
      json <- liftEffect $ readFixture "studyArmBinary"
      let result = decodeJson json :: Either _ StudyArm
      result `shouldSatisfy` isRight
      case result of
        Right arm -> do
          let rec = arm ^. _StudyArm
          rec."n" `shouldEqual` 410
          rec."rob" `shouldEqual` 1
          rec."indirectness" `shouldEqual` 1
          rec."events" `shouldSatisfy` isJust
          rec."mean" `shouldSatisfy` isNothing
          rec."sd" `shouldSatisfy` isNothing
        Left err -> fail $ show err

  -- =========================================================
  -- Schema V2: AnalysisParams
  -- =========================================================
  describe "V2 AnalysisParams" do

    it "decodes analysis params" do
      json <- liftEffect $ readFixture "analysisParamsV2"
      let result = decodeJson json :: Either _ AnalysisParams
      result `shouldSatisfy` isRight
      case result of
        Right params -> do
          let rec = params ^. _AnalysisParams
          rec."model" `shouldEqual` "fixed"
          rec."sm" `shouldEqual` "RD"
          rec."framework" `shouldEqual` Just "frequentist"
        Left err -> fail $ show err

  -- =========================================================
  -- Schema V2: HatMatrix
  -- =========================================================
  describe "V2 HatMatrix" do

    it "decodes hat matrix with correct dimensions" do
      json <- liftEffect $ readFixture "hatMatrixV2"
      let result = decodeJson json :: Either _ HatMatrix
      result `shouldSatisfy` isRight
      case result of
        Right hm -> do
          let rec = hm ^. _HatMatrix
          Array.length rec."H" `shouldEqual` 15        -- 15 rows (all comparisons)
          Array.length rec."rowNames" `shouldEqual` 15
          Array.length rec."colNames" `shouldEqual` 14  -- 14 cols (direct comparisons)
        Left err -> fail $ show err

  -- =========================================================
  -- Schema V2: ComparisonResult
  -- =========================================================
  describe "V2 ComparisonResult" do

    it "decodes a full comparison result (with direct/indirect/incoherence)" do
      json <- liftEffect $ readFixture "comparisonResultFull"
      let result = decodeJson json :: Either _ ComparisonResult
      result `shouldSatisfy` isRight
      case result of
        Right cr -> do
          let rec = cr ^. _ComparisonResult
          rec."comparison" `shouldEqual` "ACE:BBlocker"
          rec."propDirect" `shouldSatisfy` (\p -> p > 0.0)
          rec."direct" `shouldSatisfy` isJust
          rec."indirect" `shouldSatisfy` isJust
          rec."incoherence" `shouldSatisfy` isJust
          -- Check incoherence test values
          case rec."incoherence" of
            Just incoh -> do
              let irec = incoh ^. _IncoherenceTest
              irec."pvalue" `shouldSatisfy` (\p -> p >= 0.0 && p <= 1.0)
            Nothing -> fail "Expected incoherence to be present"
        Left err -> fail $ show err

    it "decodes an indirect-only comparison result (no direct evidence)" do
      json <- liftEffect $ readFixture "comparisonResultIndirectOnly"
      let result = decodeJson json :: Either _ ComparisonResult
      result `shouldSatisfy` isRight
      case result of
        Right cr -> do
          let rec = cr ^. _ComparisonResult
          rec."comparison" `shouldEqual` "ACE:ARB"
          rec."propDirect" `shouldEqual` 0.0
          rec."direct" `shouldSatisfy` isNothing
          rec."indirect" `shouldSatisfy` isJust
          rec."incoherence" `shouldSatisfy` isNothing
        Left err -> fail $ show err

  -- =========================================================
  -- Schema V2: PairwiseResult
  -- =========================================================
  describe "V2 PairwiseResult" do

    it "decodes pairwise heterogeneity result" do
      json <- liftEffect $ readFixture "pairwiseResultV2"
      let result = decodeJson json :: Either _ PairwiseResult
      result `shouldSatisfy` isRight
      case result of
        Right pr -> do
          let rec = pr ^. _PairwiseResult
          rec."comparison" `shouldEqual` "ACE:BBlocker"
          rec."tau2" `shouldSatisfy` (\t -> t >= 0.0)
          rec."I2" `shouldSatisfy` (\i -> i >= 0.0 && i <= 1.0)
          rec."I2Lower" `shouldSatisfy` isJust
          rec."I2Upper" `shouldSatisfy` isJust
        Left err -> fail $ show err

  -- =========================================================
  -- Schema V2: NetworkHeterogeneity
  -- =========================================================
  describe "V2 NetworkHeterogeneity" do

    it "decodes network heterogeneity" do
      json <- liftEffect $ readFixture "networkHeterogeneityV2"
      let result = decodeJson json :: Either _ NetworkHeterogeneity
      result `shouldSatisfy` isRight
      case result of
        Right nh -> do
          let rec = nh ^. _NetworkHeterogeneity
          rec."tau2" `shouldSatisfy` (\t -> t >= 0.0)
          rec."Qoverall" `shouldSatisfy` isJust
          rec."Qheterogeneity" `shouldSatisfy` isJust
          rec."Qinconsistency" `shouldSatisfy` isJust
        Left err -> fail $ show err

  -- =========================================================
  -- Schema V2: DesignByTreatment
  -- =========================================================
  describe "V2 DesignByTreatment" do

    it "decodes design-by-treatment test" do
      json <- liftEffect $ readFixture "designByTreatmentV2"
      let result = decodeJson json :: Either _ DesignByTreatment
      result `shouldSatisfy` isRight
      case result of
        Right dbt -> do
          let rec = dbt ^. _DesignByTreatment
          rec."Q" `shouldSatisfy` (\q -> q >= 0.0)
          rec."pvalue" `shouldSatisfy` (\p -> p >= 0.0 && p <= 1.0)
        Left err -> fail $ show err

  -- =========================================================
  -- Schema V2: Analysis (full)
  -- =========================================================
  describe "V2 Analysis" do

    it "decodes a complete analysis from export_v2.json" do
      json <- liftEffect $ readFixture "analysisV2"
      let result = decodeJson json :: Either _ Analysis
      result `shouldSatisfy` isRight
      case result of
        Right analysis -> do
          let rec = analysis ^. _Analysis
          -- params
          let prec = rec."params" ^. _AnalysisParams
          prec."model" `shouldEqual` "fixed"
          prec."sm" `shouldEqual` "RD"
          -- hatMatrix present
          rec."hatMatrix" `shouldSatisfy` isJust
          -- nmaResults has 15 comparisons
          Array.length rec."nmaResults" `shouldEqual` 15
          -- studyContributions has 15 comparisons
          FO.size rec."studyContributions" `shouldEqual` 15
          -- Check a specific contribution exists
          case FO.lookup "ACE:BBlocker" rec."studyContributions" of
            Just contribs -> FO.size contribs `shouldSatisfy` (\s -> s > 0)
            Nothing -> fail "Expected ACE:BBlocker in studyContributions"
        Left err -> fail $ show err

  -- =========================================================
  -- Schema V2: ProjectV2
  -- =========================================================
  describe "V2 ProjectV2" do

    it "decodes a v2 project" do
      json <- liftEffect $ readFixture "projectV2"
      let result = decodeJson json :: Either _ ProjectV2
      result `shouldSatisfy` isRight
      case result of
        Right proj -> do
          let rec = proj ^. _ProjectV2
          rec."format" `shouldEqual` "long"
          rec."type" `shouldEqual` "binary"
          Array.length rec."studies" `shouldEqual` 48
          Array.length rec."analyses" `shouldEqual` 1
        Left err -> fail $ show err

  -- =========================================================
  -- Schema V2: CinemaFileV2 (full file round-trip)
  -- =========================================================
  describe "V2 CinemaFileV2" do

    it "decodes the complete v2 export file" do
      json <- liftEffect $ readFixture "cinemaFileV2"
      let result = readCinemaFileV2 json
      case result of
        Right file -> do
          let proj = (file ^. _CinemaFileV2)."project" ^. _ProjectV2
          proj."format" `shouldEqual` "long"
          proj."type" `shouldEqual` "binary"
          Array.length proj."studies" `shouldEqual` 48
          Array.length proj."analyses" `shouldEqual` 1
        Left err -> fail $ "CinemaFileV2 decode failed: " <> err

    it "rejects malformed JSON (missing required fields)" do
      let badJson = encodeJson { project: { format: "long" } }
      let result = readCinemaFileV2 badJson
      case result of
        Left _ -> pure unit  -- Expected failure
        Right _ -> fail "Should have rejected incomplete data"
