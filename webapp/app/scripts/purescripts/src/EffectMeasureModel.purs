module EffectMeasure where 

import Prelude
import Effect 
import Data.Array
import Data.Argonaut 
import Data.Argonaut.Decode.Error (JsonDecodeError(..))
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


-- EffectMeasureType <
data EffectMeasureType = RR | OR | RD | MD | SMD

derive instance genericEffectMeasureType :: Rep.Generic EffectMeasureType _

instance showEffectMeasureType :: Show EffectMeasureType where
  show RR  = "RR"
  show OR  = "OR"
  show RD  = "RD"
  show MD  = "MD"
  show SMD = "SMD"

instance decodeEffectMeasureType :: DecodeJson EffectMeasureType where
  decodeJson = readEffectMeasureType

readEffectMeasureType :: Json -> Either JsonDecodeError EffectMeasureType
readEffectMeasureType fem = do
  -- TODO: Fix decoder
  let mem = decodeJson fem :: Either JsonDecodeError String
  case mem  of 
       Left _ -> Left $ TypeMismatch "not a string"
       Right em -> case em of 
                        "RR" -> pure RR
                        "OR" -> pure OR
                        "RD" -> pure RD
                        "MD" -> pure MD
                        "SMD" -> pure SMD
                        otherwise -> Left $ TypeMismatch "unknown effect measure type"

isRatio :: EffectMeasureType -> Boolean
isRatio RR  = true
isRatio OR  = true
isRatio RD  = false
isRatio MD  = false
isRatio SMD = false

-- EffectMeasureType <
