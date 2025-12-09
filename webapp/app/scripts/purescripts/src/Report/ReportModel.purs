module Report.Model where

import Prelude
import Effect 
import Data.Argonaut 
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
  decodeJson = genericDecodeJson
_StudyLimitation :: Lens' StudyLimitation (Record _)
_StudyLimitation = lens (\(StudyLimitation s) -> s) (\_ -> StudyLimitation)

skeletonStudyLimitation = StudyLimitation { id : "None"
                                          , customized : false
                                          , label : "--"
                                          , value : 0
                                          , rules : []
                                          , color : ""
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
  decodeJson = genericDecodeJson
_ReportJudgement :: Lens' ReportJudgement (Record _)
_ReportJudgement = lens (\(ReportJudgement s) -> s) (\_ -> ReportJudgement)


newtype ReportRow = ReportRow 
  { id :: String
  , armA:: String
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
  decodeJson = genericDecodeJson
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
  decodeJson = genericDecodeJson
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
  decodeJson = genericDecodeJson
_ReportLevel :: Lens' ReportLevel (Record _)
_ReportLevel = lens (\(ReportLevel s) -> s) (\_ -> ReportLevel)

skeletonReportLevel :: ReportLevel
skeletonReportLevel = ReportLevel 
  { id : 666
  , color : "black"
  , label : "--"
  , selected : false
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
  decodeJson = genericDecodeJson
_ReasonLevel :: Lens' ReasonLevel (Record _)
_ReasonLevel = lens (\(ReasonLevel s) -> s) (\_ -> ReasonLevel)

skeletonReasonLevel :: ReasonLevel
skeletonReasonLevel = ReasonLevel 
  { id : 666
  , color : "black"
  , label : "--"
  , allowed : true
  , selected : false
  }
