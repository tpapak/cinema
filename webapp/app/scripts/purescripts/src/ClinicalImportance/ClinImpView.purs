module ClinImp.View where

import Prelude
import Effect 
import Effect.Unsafe
import Effect.Console (log, logShow)
import Data.Array
import Data.String as S
import Data.Argonaut (Json)
import Data.Argonaut.Decode.Class (class DecodeJson, decodeJson)
import Data.Argonaut.Encode.Class (class EncodeJson, encodeJson)
-- import Data.Argonaut.Index ((!)) -- REMOVED: Use getField from Data.Argonaut
-- import Data.Argonaut.Generic -- REMOVED: Use DecodeJson instances
import Data.Generic.Rep as Rep 
import Data.Show.Generic (genericShow)
import Control.Monad.Except (runExcept)
import Data.Function
import Data.Maybe
import Data.Either (Either(..))
import Data.Traversable
-- import Text.Handlebars (compile) -- TODO: Add handlebars dependency or use alternative
import Data.Lens 
import Data.Lens.Index
import Data.Lens.Record
import Data.Lens.Traversal
-- import Text.Smolder.Renderer.String (render) as S -- TODO: Add smolder dependency 
import Partial.Unsafe (unsafePartial)

import Report.Template as T
import Model
import Text.Model
import StudyLimitationsModel
import InconsistencyModel
import ClinImp.Model


register :: forall e. Json -> Unit
register s = unit

isReady :: State -> Boolean
isReady st = (st ^. _State <<< project <<< _Project 
             <<< clinImp <<< _ClinImp)
             ."status" == "ready"
