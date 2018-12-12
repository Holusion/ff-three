/**
 * FF Typescript Foundation Library
 * Copyright 2018 Ralph Wiedemeier, Frame Factory GmbH
 *
 * License: MIT
 */

import * as THREE from "three";
import { types } from "@ff/core/ecs";
import Geometry from "./Geometry";

////////////////////////////////////////////////////////////////////////////////

export default class Box extends Geometry
{
    static readonly type: string = "Box";

    ins = this.ins.append({
        size: types.Vector3("Size", [ 10, 10, 10 ]),
        segments: types.Vector3("Segments", [ 1, 1, 1])
    });

    update()
    {
        const { size, segments } = this.ins;
        if (size.changed || segments.changed) {
            this.geometry = new THREE.BoxBufferGeometry(
                size.value[0], size.value[1], size.value[2],
                segments.value[0], segments.value[1], segments.value[2]
            );
        }

        return true;
    }
}