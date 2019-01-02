/**
 * FF Typescript Foundation Library
 * Copyright 2018 Ralph Wiedemeier, Frame Factory GmbH
 *
 * License: MIT
 */

import * as THREE from "three";
import { computeLocalBoundingBox } from "./helpers";

////////////////////////////////////////////////////////////////////////////////

const _vec3 = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();

export interface IBracketProps
{
    /** Color of the bracket lines. Default is white. */
    color?: THREE.Color;
    /** Length of the bracket lines relative to the size of the object. Default is 0.25. */
    length?: number;
}

/**
 * Wireframe selection bracket.
 */
export default class Bracket extends THREE.LineSegments
{
    static readonly defaultProps = {
        color: new THREE.Color("#ffd633"),
        length: 0.25
    };

    constructor(parent: THREE.Object3D, props?: IBracketProps)
    {
        props = Object.assign({}, Bracket.defaultProps, props);

        const box = new THREE.Box3();
        box.makeEmpty();

        computeLocalBoundingBox(parent, box);

        const length = props.length;
        const min = [ box.min.x, box.min.y, box.min.z ];
        const max = [ box.max.x, box.max.y, box.max.z ];
        const size = [ (max[0] - min[0]) * length, (max[1] - min[1]) * length, (max[2] - min[2]) * length ];
        let vertices;

        if (isFinite(size[0]) && isFinite(size[1]) && isFinite(size[2])) {
            vertices = [
                min[0], min[1], min[2], min[0] + size[0], min[1], min[2],
                min[0], min[1], min[2], min[0], min[1] + size[1], min[2],
                min[0], min[1], min[2], min[0], min[1], min[2] + size[2],

                max[0], min[1], min[2], max[0] - size[0], min[1], min[2],
                max[0], min[1], min[2], max[0], min[1] + size[1], min[2],
                max[0], min[1], min[2], max[0], min[1], min[2] + size[2],

                min[0], max[1], min[2], min[0] + size[0], max[1], min[2],
                min[0], max[1], min[2], min[0], max[1] - size[1], min[2],
                min[0], max[1], min[2], min[0], max[1], min[2] + size[2],

                min[0], min[1], max[2], min[0] + size[0], min[1], max[2],
                min[0], min[1], max[2], min[0], min[1] + size[1], max[2],
                min[0], min[1], max[2], min[0], min[1], max[2] - size[2],

                min[0], max[1], max[2], min[0] + size[0], max[1], max[2],
                min[0], max[1], max[2], min[0], max[1] - size[1], max[2],
                min[0], max[1], max[2], min[0], max[1], max[2] - size[2],

                max[0], min[1], max[2], max[0] - size[0], min[1], max[2],
                max[0], min[1], max[2], max[0], min[1] + size[1], max[2],
                max[0], min[1], max[2], max[0], min[1], max[2] - size[2],

                max[0], max[1], min[2], max[0] - size[0], max[1], min[2],
                max[0], max[1], min[2], max[0], max[1] - size[1], min[2],
                max[0], max[1], min[2], max[0], max[1], min[2] + size[2],

                max[0], max[1], max[2], max[0] - size[0], max[1], max[2],
                max[0], max[1], max[2], max[0], max[1] - size[1], max[2],
                max[0], max[1], max[2], max[0], max[1], max[2] - size[2],
            ];
        }
        else {
            vertices = [
                -1, 0, 0, 1, 0, 0,
                0, -1, 0, 0, 1, 0,
                0, 0, -1, 0, 0, 1,
            ];
        }

        const geometry = new THREE.BufferGeometry();
        geometry.addAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));

        const material = new THREE.LineBasicMaterial({
            color: props.color
        });

        super(geometry, material);
    }

    protected static expandBoundingBox(object: THREE.Object3D, root: THREE.Object3D, box: THREE.Box3)
    {
        const geometry = (object as any).geometry;
        if (geometry !== undefined) {

            let parent = object;
            _mat4.identity();
            while(parent && parent !== root) {
                _mat4.premultiply(parent.matrix);
                parent = parent.parent;
            }

            if (geometry.isGeometry) {
                const vertices = geometry.vertices;
                for (let i = 0, n = vertices.length; i < n; ++i) {
                    _vec3.copy(vertices[i]).applyMatrix4(_mat4);
                    box.expandByPoint(_vec3);
                }
            }
            else if (geometry.isBufferGeometry) {
                const attribute = geometry.attributes.position;
                if (attribute !== undefined) {
                    for (let i = 0, n = attribute.count; i < n; ++i) {
                        _vec3.fromBufferAttribute(attribute, i).applyMatrix4(_mat4);
                        box.expandByPoint(_vec3);
                    }
                }
            }
        }

        const children = object.children;
        for (let i = 0, n = children.length; i < n; ++i) {
            Bracket.expandBoundingBox(children[i], root, box);
        }
    }
}