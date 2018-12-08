/**
 * FF Typescript Foundation Library
 * Copyright 2018 Ralph Wiedemeier, Frame Factory GmbH
 *
 * License: MIT
 */

import * as THREE from "three";

import { Readonly } from "@ff/core/types";
import math from "@ff/core/math";

import types from "@ff/core/ecs/propertyTypes";
import Hierarchy from "@ff/core/ecs/Hierarchy";

////////////////////////////////////////////////////////////////////////////////

const _vec3 = new THREE.Vector3();

export enum ERotationOrder { XYZ, YZX, ZXY, XZY, YXZ, ZYX }

/**
 * Allows arranging components in a hierarchical structure. Each [[TransformComponent]]
 * contains a transformation which affects its children as well as other components which
 * are part of the same entity.
 */
export default class Transform extends Hierarchy
{
    static readonly type: string = "Transform";

    ins = this.ins.append({
        pos: types.Vector3("Position"),
        rot: types.Vector3("Rotation"),
        ord: types.Enum("Order", ERotationOrder),
        sca: types.Vector3("Scale", [ 1, 1, 1 ])
    });

    outs = this.ins.append({
        mat: types.Matrix4("Matrix")
    });

    private _object: THREE.Object3D;

    constructor(id?: string)
    {
        super(id);

        this._object = new THREE.Object3D();
        this._object.matrixAutoUpdate = false;
    }

    update()
    {
        const object = this._object;
        const { pos, rot, ord, sca, mat } = this.ins;
        const matOut = this.outs.mat;

        if (mat.changed) {
            object.matrix.fromArray(mat.value);
            object.matrixWorldNeedsUpdate = true;
        }
        else {
            object.position.fromArray(pos.value);
            _vec3.fromArray(rot.value).multiplyScalar(math.DEG2RAD);
            const order = types.getEnumName(ERotationOrder, ord.value);
            object.rotation.setFromVector3(_vec3, order);
            object.scale.fromArray(sca.value);
            object.updateMatrix();
        }

        (object.matrix as any).toArray(matOut.value);
        matOut.push();
    }

    dispose()
    {
        if (!this._object) {
            return;
        }

        // detach the three.js object from its parent and children
        if (this._object.parent) {
            this._object.parent.remove(this._object);
        }
        this._object.children.slice().forEach(child => this._object.remove(child));

        super.dispose();
    }

    /**
     * Returns the three.js renderable object wrapped in this component.
     * @returns {Object3D}
     */
    get object3D(): THREE.Object3D
    {
        return this._object;
    }

    /**
     * Returns an array of child components of this.
     * @returns {Readonly<Hierarchy[]>}
     */
    get children(): Readonly<Transform[]>
    {
        return this._children as Transform[] || [];
    }

    /**
     * Returns a reference to the local transformation matrix.
     * @returns {TMatrix4}
     */
    get matrix(): Readonly<THREE.Matrix4>
    {
        return this._object.matrix;
    }

    /**
     * Adds a child [[HierarchyComponent]] or [[TransformComponent]] to this.
     * @param {Transform} component
     */
    addChild(component: Transform)
    {
        super.addChild(component);
        this._object.add(component._object);
    }

    /**
     * Removes a child [[HierarchyComponent]] or [[TransformComponent]] from this.
     * @param {Transform} component
     */
    removeChild(component: Transform)
    {
        this._object.remove(component._object);
        super.removeChild(component);
    }

    /**
     * Called by [[Object3DComponent]] to attach its three.js renderable object to the transform component.
     * Do not call this directly.
     * @param {Object3D} object
     */
    addObject3D(object: THREE.Object3D)
    {
        this._object.add(object);
    }

    /**
     * Called by [[Object3DComponent]] to detach its three.js renderable object from the transform component.
     * Do not call this directly.
     * @param {Object3D} object
     */
    removeObject3D(object: THREE.Object3D)
    {
        this._object.remove(object);
    }
}
