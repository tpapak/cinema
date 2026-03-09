module Report.Model where

import Prelude
import Effect
import Data.Argonaut
import Data.Argonaut.Core (toObject)
import Data.Argonaut.Decode.Error (JsonDecodeError(..))
import Data.Argonaut.Decode.Combinators (getField)
import Data.Argonaut.Decode.Class (class DecodeJson, decodeJson)
import Data.Argonaut.Encode.Class (class EncodeJson, encodeJson)
-- import Data.Argonaut.Index ((!)) -- REMOVED: Use getField from Data.Argonaut
import Data.Argonaut.Decode.Generic (genericDecodeJson)
import Data.Generic.Rep as Rep
import Data.Show.Generic (genericShow)
import Control.Monad.Except (runExcept)
import Data.Maybe (Maybe(..))
import Data.Either (Either(..))
import Data.Int
import Data.Newtype
import Data.Symbol
import Type.Proxy (Proxy(..))
import Data.Lens
import Data.Lens.Record (prop)
import Data.Lens.Zoom (Traversal, Traversal', Lens, Lens', zoom)

import StudyLimitationsModel
import ComparisonModel
import InconsistencyModel
import ImprecisionModel
import IndirectnessModel
import PubbiasModel

newtype StudyLimitation = StudyLimitation
  { id :: String
  , customized :: Boolean
  , label :: String
  , value :: Int
  , rules :: Array RobRule
  , color :: String
  }

derive instance genericStudyLimitation :: Rep.Generic StudyLimitation _
instance showStudyLimitation :: Show StudyLimitation where
  show = genericShow

instance decodeStudyLimitation :: DecodeJson StudyLimitation where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      i <- getField obj "id"
      c <- getField obj "customized"
      l <- getField obj "label"
      v <- getField obj "value"
      r <- getField obj "rules"
      col <- getField obj "color"
      pure $ StudyLimitation { id: i, customized: c, label: l, value: v, rules: r, color: col }

_StudyLimitation :: Lens' StudyLimitation (Record _)
_StudyLimitation = lens (\(StudyLimitation s) -> s) (\_ -> StudyLimitation)

skeletonStudyLimitation = StudyLimitation
  { id: "None"
  , customized: false
  , label: "--"
  , value: 0
  , rules: []
  , color: ""
  }

newtype ReportJudgement = ReportJudgement
  { selected :: ReportLevel
  , levels :: Array ReportLevel
  , reasons :: Array ReasonLevel
  }

derive instance genericReportJudgement :: Rep.Generic ReportJudgement _
instance showReportJudgement :: Show ReportJudgement where
  show = genericShow

instance decodeReportJudgement :: DecodeJson ReportJudgement where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      s <- getField obj "selected"
      l <- getField obj "levels"
      r <- getField obj "reasons"
      pure $ ReportJudgement { selected: s, levels: l, reasons: r }

_ReportJudgement :: Lens' ReportJudgement (Record _)
_ReportJudgement = lens (\(ReportJudgement s) -> s) (\_ -> ReportJudgement)

newtype ReportRow = ReportRow
  { id :: String
  , armA :: String
  , armB :: String
  , numberOfStudies :: Int
  , studyLimitation :: StudyLimitation
  , heterogeneity :: HeterogeneityBox
  , incoherence :: IncoherenceBox
  , judgement :: ReportJudgement
  , imprecision :: ImprecisionBox
  , indirectness :: IndirectnessBox
  , pubbias :: PubbiasBox
  }

derive instance genericReportRow :: Rep.Generic ReportRow _
instance showReportRow :: Show ReportRow where
  show = genericShow

instance decodeReportRow :: DecodeJson ReportRow where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      i <- getField obj "id"
      aa <- getField obj "armA"
      ab <- getField obj "armB"
      nos <- getField obj "numberOfStudies"
      sl <- getField obj "studyLimitation"
      het <- getField obj "heterogeneity"
      inc <- getField obj "incoherence"
      jdg <- getField obj "judgement"
      imp <- getField obj "imprecision"
      ind <- getField obj "indirectness"
      pub <- getField obj "pubbias"
      pure $ ReportRow { id: i, armA: aa, armB: ab, numberOfStudies: nos, studyLimitation: sl, heterogeneity: het, incoherence: inc, judgement: jdg, imprecision: imp, indirectness: ind, pubbias: pub }

_ReportRow :: Lens' ReportRow (Record _)
_ReportRow = lens (\(ReportRow s) -> s) (\_ -> ReportRow)

judgement :: forall a b r. Lens { judgement :: a | r } { judgement :: b | r } a b
judgement = prop (Proxy :: Proxy "judgement")

newtype Report = Report
  { status :: String
  , hasChanged :: Boolean
  , directRows :: Array ReportRow
  , indirectRows :: Array ReportRow
  }

derive instance genericReport :: Rep.Generic Report _
instance showReport :: Show Report where
  show = genericShow

instance decodeReport :: DecodeJson Report where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      st <- getField obj "status"
      hc <- getField obj "hasChanged"
      dr <- getField obj "directRows"
      ir <- getField obj "indirectRows"
      pure $ Report { status: st, hasChanged: hc, directRows: dr, indirectRows: ir }

_Report :: Lens' Report (Record _)
_Report = lens (\(Report s) -> s) (\_ -> Report)

report :: forall a b r. Lens { report :: a | r } { report :: b | r } a b
report = prop (Proxy :: Proxy "report")

newtype ReportLevel = ReportLevel
  { id :: Int
  , color :: String
  , label :: String
  , selected :: Boolean
  }

derive instance genericReportLevel :: Rep.Generic ReportLevel _
instance showReportLevel :: Show ReportLevel where
  show = genericShow

instance decodeReportLevel :: DecodeJson ReportLevel where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      i <- getField obj "id"
      c <- getField obj "color"
      l <- getField obj "label"
      s <- getField obj "selected"
      pure $ ReportLevel { id: i, color: c, label: l, selected: s }

_ReportLevel :: Lens' ReportLevel (Record _)
_ReportLevel = lens (\(ReportLevel s) -> s) (\_ -> ReportLevel)

skeletonReportLevel :: ReportLevel
skeletonReportLevel = ReportLevel
  { id: 666
  , color: "black"
  , label: "--"
  , selected: false
  }

newtype ReasonLevel = ReasonLevel
  { id :: Int
  , color :: String
  , label :: String
  , allowed :: Boolean
  , selected :: Boolean
  }

derive instance genericReasonLevel :: Rep.Generic ReasonLevel _
instance showReasonLevel :: Show ReasonLevel where
  show = genericShow

instance decodeReasonLevel :: DecodeJson ReasonLevel where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      i <- getField obj "id"
      c <- getField obj "color"
      l <- getField obj "label"
      a <- getField obj "allowed"
      s <- getField obj "selected"
      pure $ ReasonLevel { id: i, color: c, label: l, allowed: a, selected: s }

_ReasonLevel :: Lens' ReasonLevel (Record _)
_ReasonLevel = lens (\(ReasonLevel s) -> s) (\_ -> ReasonLevel)

skeletonReasonLevel :: ReasonLevel
skeletonReasonLevel = ReasonLevel
  { id: 666
  , color: "black"
  , label: "--"
  , allowed: true
  , selected: false
  }
