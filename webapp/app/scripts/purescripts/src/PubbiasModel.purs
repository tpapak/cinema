module PubbiasModel where

import Prelude
import Effect 
import Data.Array
import Data.Argonaut.Core (Json, toObject)
import Data.Argonaut.Decode.Error (JsonDecodeError(..))
import Data.Argonaut 
import Data.Argonaut.Decode.Combinators (getField)
import Data.Argonaut.Decode.Class (class DecodeJson, decodeJson)
import Data.Argonaut.Encode.Class (class EncodeJson, encodeJson)
-- import Data.Argonaut.Index ((!)) -- REMOVED: Use getField from Data.Argonaut
import Data.Argonaut.Decode.Generic (genericDecodeJson)
import Data.Generic.Rep as Rep 
import Data.Show.Generic (genericShow)
import Control.Monad.Except (runExcept)
import Data.Maybe
import Data.Either
import Data.Int
import Data.Newtype
import Data.Symbol
import Type.Proxy (Proxy(..))
import Data.Lens
import Data.Lens.Record (prop)
import Data.Lens.Zoom (Traversal, Traversal', Lens, Lens', zoom)
import Partial.Unsafe (unsafePartial)

import Text.Model
import ComparisonModel


-- Pubbias <
newtype Pubbias = Pubbias
    { status :: String
    , boxes :: Array PubbiasBox
    }
_Pubbias :: Lens' Pubbias (Record _)
_Pubbias = lens (\(Pubbias s) -> s) (\_ -> Pubbias)
derive instance genericPubbias :: Rep.Generic Pubbias _
instance showPubbias :: Show Pubbias where
    show = genericShow
instance decodePubbias :: DecodeJson Pubbias where
  decodeJson = genericDecodeJson
-- Pubbias >

-- PubbiasBox <
newtype PubbiasBox = PubbiasBox
    { id :: String
    , judgement :: Int
    , label :: String
    , levels :: Array PubbiasLevel
    , color :: String
    , ruleLevel :: Int
    , customized :: Boolean
    }
_PubbiasBox :: Lens' PubbiasBox (Record _)
_PubbiasBox = lens (\(PubbiasBox s) -> s) (\_ -> PubbiasBox)
derive instance genericPubbiasBox :: Rep.Generic PubbiasBox _
instance showPubbiasBox :: Show PubbiasBox where
    show = genericShow
skeletonPubbiasBox = PubbiasBox { id : "None"
                                        , judgement : -1
                                        , label : "--"
                                        , levels : []
                                        , color : ""
                                        , ruleLevel : -1
                                        , customized : false
                                        }
instance decodePubbiasBox :: DecodeJson PubbiasBox where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      id <- getField obj "id"
      judgement <- getField obj "judgement"
      levels <- getField obj "levels"
      let color = ""
      let label = "--"
      customized <- pure false
      pure $ PubbiasBox { id
                              , levels
                              , judgement
                              , ruleLevel: -1
                              , label
                              , customized
                              , color }
pubbiasboxlabel :: forall a b r. Lens { label :: a | r } { label :: b | r } a b
pubbiasboxlabel = prop (Proxy :: Proxy "label")
pubbiasboxcolor :: forall a b r. Lens { color :: a | r } { color :: b | r } a b
pubbiasboxcolor = prop (Proxy :: Proxy "color")
pubbiasboxcustomized :: forall a b r. Lens { customized :: a | r } { customized :: b | r } a b
pubbiasboxcustomized = prop (Proxy :: Proxy "customized")


{--type StringComparisonIds = Array String--}
  
{--instance decodeStringComparisonIds :: DecodeJson StringComparisonIds where--}
  {--decode = genericDecodeJson--}
-- PubbiasBox >


-- PubbiasLevel <
newtype PubbiasLevel = PubbiasLevel
    { id :: Int
    , color :: String
    }
_PubbiasLevel :: Lens' PubbiasLevel (Record _)
_PubbiasLevel = lens (\(PubbiasLevel s) -> s) (\_ -> PubbiasLevel)
derive instance genericPubbiasLevel :: Rep.Generic PubbiasLevel _
instance showPubbiasLevel :: Show PubbiasLevel where
    show = genericShow
instance decodePubbiasLevel :: DecodeJson PubbiasLevel where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      id <- getField obj "id"
      color <- getField obj "color"
      pure $ PubbiasLevel { id
                                , color }
-- PubbiasLevel >
