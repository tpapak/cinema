module StudyLimitationsModel where

import Prelude
import Effect 
import Data.Argonaut.Core (Json, toObject)
import Data.Argonaut.Decode.Combinators (getField)
import Data.Argonaut.Decode.Class (class DecodeJson, decodeJson)
import Data.Argonaut.Decode.Error (JsonDecodeError(..))
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


-- RoBLevel <
newtype RoBLevel = RoBLevel
  { id :: Int
  , color :: String
  , label :: String
  }
derive instance genericRoBLevel :: Rep.Generic RoBLevel _
instance showRoBLevel :: Show RoBLevel where
    show = genericShow
instance decodeRoBLevel :: DecodeJson RoBLevel where
  decodeJson = genericDecodeJson
_RoBLevel :: Lens' RoBLevel (Record _)
_RoBLevel = lens (\(RoBLevel s) -> s) (\_ -> RoBLevel)

skeletonRoBLevel =  RoBLevel { id : 0
                             , color: "none"
                             , label: "none"
                             }
-- RoBLevel >


-- NetRobModel <
newtype NetRobModel = NetRobModel
  { status :: String
  , studyLimitations :: StudyLimitations
  }
derive instance genericNetRobModel :: Rep.Generic NetRobModel _
instance showNetRobModel :: Show NetRobModel where
    show = genericShow
instance decodeNetRobModel :: DecodeJson NetRobModel where
  decodeJson = genericDecodeJson
_NetRobModel :: Lens' NetRobModel (Record _)
_NetRobModel = lens (\(NetRobModel s) -> s) (\_ -> NetRobModel)
studyLimitations :: forall a b r. Lens { studyLimitations :: a | r } { studyLimitations :: b | r } a b
studyLimitations = prop (Proxy :: Proxy "studyLimitations")
-- NetRobModel >

-- StudyLimitations <
newtype StudyLimitations = StudyLimitations
    { customized :: Number
    , rule :: String
    , status :: String
    , boxes :: Array NetRob
    }
derive instance genericStudyLimitations :: Rep.Generic StudyLimitations _
instance showStudyLimitations :: Show StudyLimitations where
    show = genericShow
instance decodeStudyLimitations :: DecodeJson StudyLimitations where
  decodeJson = genericDecodeJson
_StudyLimitations :: Lens' StudyLimitations (Record _)
_StudyLimitations = lens (\(StudyLimitations s) -> s) (\_ -> StudyLimitations)
boxes :: forall a b r. Lens { boxes :: a | r } { boxes :: b | r } a b
boxes = prop (Proxy :: Proxy "boxes")
-- StudyLimitations >

-- NetRob <
newtype NetRob = NetRob
    { id :: String
    , judgement :: Int
    , rules :: Array RobRule
    , color :: String
    }
derive instance genericNetRob :: Rep.Generic NetRob _
instance showNetRob :: Show NetRob where
    show = genericShow
instance decodeNetRob :: DecodeJson NetRob where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      id <- getField obj "id"
      color <- getField obj "color"
      let sjResult = getField obj "judgement" :: Either JsonDecodeError Int
      let judgement = case sjResult of
             Left _ -> (-1)
             Right ij -> ij
      rules <- getField obj "rules"
      pure $ NetRob { id
                    , judgement
                    , rules
                    , color
                    }
_NetRob :: Lens' NetRob (Record _)
_NetRob = lens (\(NetRob s) -> s) (\_ -> NetRob)
rules :: forall a b r. Lens { rules :: a | r } { rules :: b | r } a b
rules = prop (Proxy :: Proxy "rules")
-- NetRob >

-- RobRule <
newtype RobRule = RobRule
    { id :: String
    , isActive :: Boolean
    , label :: String
    , name :: String
    , value :: Int
    }
derive instance genericRobRule :: Rep.Generic RobRule _
instance showRobRule :: Show RobRule where
    show = genericShow
instance decodeRobRule :: DecodeJson RobRule where
  decodeJson = genericDecodeJson
_RobRule :: Lens' RobRule (Record _)
_RobRule = lens (\(RobRule s) -> s) (\_ -> RobRule)

skeletonRobRule = RobRule 
    { id : "Nothing"
    , isActive : false
    , label : "Nothing"
    , name : "Nothing"
    , value : 0
    }
-- RobRule >

