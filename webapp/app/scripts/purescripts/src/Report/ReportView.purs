module Report.View where

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
import Data.Argonaut.Decode.Generic (genericDecodeJson)
import Data.Generic.Rep as Rep
import Data.Show.Generic (genericShow)
import Control.Monad.Except (runExcept)
import Data.Function
import Data.Either (Either(..))
import Data.Traversable
import Handlebars (compile)
import Data.Lens
import Data.Lens.Index
import Data.Lens.Record
import Data.Lens.Traversal
-- import Text.Smolder.Renderer.String (render) as S -- TODO: Add smolder dependency 

import Report.Template as T
import Model
import Text.Model
import StudyLimitationsModel
import ComparisonModel
import InconsistencyModel
import ImprecisionModel
import IndirectnessModel
import PubbiasModel
import Report.Model
import Report.Update as RU

register :: forall e. Json -> Unit
register s = unit

isReady :: State -> Boolean
isReady st =
  ( st ^. _State <<< project <<< _Project
      <<< report
      <<< _Report
  )."status" == "ready"

type ViewModel r =
  { isReady :: Boolean
  , directRows :: Array ReportRow
  , indirectRows :: Array ReportRow
  , hasDirects :: Boolean
  , hasIndirects :: Boolean
  | r
  }

template :: State -> String
template a =
  let
    b :: ViewModel (project :: Project)
    b =
      { project: a ^. _State <<< project
      , isReady: isReady a
      , directRows: RU.directRows a
      , indirectRows: RU.indirectRows a
      , hasDirects: RU.hasDirects a
      , hasIndirects: RU.hasIndirects a
      }
    viewData = b
  in
    compile T.template viewData

errorTemplate :: forall a. a -> String
errorTemplate = compile
  "<div class='error-cont error col-md-offset-1 \
  \ col-md-10'> {{{.}}} </div>"
