module Imprecision.Rules where

import Prelude
import Effect 
import Effect.Unsafe
import Effect.Console (log, logShow)
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
import Data.Either (Either(..), isLeft, fromRight)
import Data.Int
import Data.String as S
import Data.Symbol
import Type.Proxy (Proxy(..))
import Data.Lens
import Data.Lens.Index
import Data.Lens.Record (prop)
import Data.Lens.Zoom (Traversal, Traversal', Lens, Lens', zoom)
import Partial.Unsafe (unsafePartial)

import ComparisonModel
import ImprecisionModel
import Model
import Text.Model
import SaveModel



getState :: Json  -> Effect Unit
getState mdl = do
  let (s :: Either String State) = readState mdl
  case s of
     Left err -> log $ "error in state " <> err
     Right st -> do
       let selects = getSelected st
           allnodes = (st  ^. _State <<< project <<< _Project 
                <<< studies <<< _Studies)."nodes"
           nds = filter (isSelectedNode selects) allnodes
           lkj = map (stringToComparison ":") selects
       {--log $ "all nodes are " <> show allnodes--}
       log $ "THE  E E E E E E Eselected nodes are " <> show nds

isTheSameComparison :: Json -> Json -> Boolean
isTheSameComparison fc1 fc2 = do
  -- TODO: Fix decoder
  let ec1 = decodeJson fc1 :: Either JsonDecodeError String
  -- TODO: Fix decoder
  let ec2 = decodeJson fc2 :: Either JsonDecodeError String
  if any isLeft [ec1, ec2] then
    false
    else do
      let c1 = case ec1 of
             Left _ -> skeletonComparison
             Right sc1 -> stringToComparison ":" sc1
          c2 = case ec2 of
             Left _ -> skeletonComparison
             Right sc2 -> stringToComparison ":" sc2
      c1 == c2 && (c1 /= skeletonComparison) && (c2 /= skeletonComparison)

{--CIlow effect CIhigh zonelower Null zonehigher--}
numberOfCrosses :: Json -> Json -> Json -> Json -> Json -> Json -> Int
numberOfCrosses fil feffect fih fzl fnul fzh = do
  let eil = decodeJson fil
  let eeffect = decodeJson feffect
  let eih = decodeJson fih
  let ezl = decodeJson fzl
  let enul = decodeJson fnul
  let ezh = decodeJson fzh
  let fromRight = (\e -> case e of
                   Left _ -> -1.0
                   Right v -> v)
  case any isLeft [eil, eeffect, eih, ezl, enul, ezh] of
    true  -> -1
    false -> 
      let il = fromRight eil
          effect = fromRight eeffect
          ih = fromRight eih
          zl' = fromRight ezl
          zh' = fromRight ezh
          effectInZone = il > zl' && ih < zh'
          nul = fromRight enul
          {--Toshi's rule--}
          zl = if (effect > nul) then
                 zl' else nul
          zh = if (effect < nul) then
                 zh' else nul
          t1 = zl - ih
          t2 = zh - il
          d1 = zl - il
          d2 = zh - ih
       in if effectInZone
            then 0
            else
              case t1 * t2 > 0.0 of
                true  -> 0
                false -> case d1 * d2 > 0.0 of
                             true -> 1
                             false -> case d2 > 0.0 of
                                           true -> 0
                                           false -> 2

ruleLevel :: Json -> Json -> Int
ruleLevel fcicrs fpricrs = 
  let ecicrs = decodeJson fcicrs
      epricrs = decodeJson fpricrs
      fromRight = (\e -> case e of
                     Left _ -> -1
                     Right v -> v)
  in case any isLeft [ecicrs, epricrs] of
       true -> -1
       false -> 
         let cicrs  = fromRight ecicrs
             pricrs = fromRight epricrs
             ruleTable = [[1,2,3],[0,1,2],[0,0,1]]
          in unsafePartial $ fromJust ((unsafePartial $ fromJust 
               (ruleTable !! cicrs )) !! pricrs)
