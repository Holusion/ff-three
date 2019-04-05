/**
 * FF Typescript Foundation Library
 * Copyright 2018 Ralph Wiedemeier, Frame Factory GmbH
 *
 * License: MIT
 */

import * as THREE from "three";

import math from "@ff/core/math";

import {
    IManip,
    IPointerEvent,
    ITriggerEvent
} from "@ff/browser/ManipTarget";

import threeMath from "./math";
import UniversalCamera from "./UniversalCamera";

////////////////////////////////////////////////////////////////////////////////

const _mat4 = new THREE.Matrix4();
const _box3 = new THREE.Box3();
const _vec3a = new THREE.Vector3();
const _vec3b = new THREE.Vector3();

enum EControllerMode { Orbit, FirstPerson }
enum EManipMode { Off, Pan, Orbit, Dolly, Zoom, PanDolly, Roll }
enum EManipPhase { Off, Active, Release }


export default class CameraController implements IManip
{
    camera: UniversalCamera;

    orbit = new THREE.Vector3(0, 0, 0);
    offset = new THREE.Vector3(0, 0, 50);

    minOrbit = new THREE.Vector3(-90, -Infinity, -Infinity);
    maxOrbit = new THREE.Vector3(90, Infinity, Infinity);
    minOffset = new THREE.Vector3(-Infinity, -Infinity, 0.1);
    maxOffset = new THREE.Vector3(Infinity, Infinity, 1000);

    orientationEnabled = true;
    offsetEnabled = true;

    protected mode = EManipMode.Off;
    protected phase = EManipPhase.Off;
    protected prevPinchDist = 0;

    protected deltaX = 0;
    protected deltaY = 0;
    protected deltaPinch = 0;
    protected deltaWheel = 0;

    protected viewportWidth = 100;
    protected viewportHeight = 100;

    constructor(camera?: UniversalCamera)
    {
        this.camera = camera;
    }

    onPointer(event: IPointerEvent)
    {
        if (event.isPrimary) {
            if (event.type === "pointer-down") {
                this.phase = EManipPhase.Active;
            }
            else if (event.type === "pointer-up") {
                this.phase = EManipPhase.Release;
                return true;
            }
        }

        if (event.type === "pointer-down") {
            this.mode = this.getModeFromEvent(event);
        }

        const keyMultiplier = 1;

        this.deltaX += event.movementX * keyMultiplier;
        this.deltaY += event.movementY * keyMultiplier;

        // calculate pinch
        if (event.pointerCount === 2) {
            const positions = event.activePositions;
            const dx = positions[1].clientX - positions[0].clientX;
            const dy = positions[1].clientY - positions[0].clientY;
            const pinchDist = Math.sqrt(dx * dx + dy * dy);

            const prevPinchDist = this.prevPinchDist || pinchDist;
            this.deltaPinch *= prevPinchDist > 0 ? (pinchDist / prevPinchDist) : 1;
            this.prevPinchDist = pinchDist;
        }
        else {
            this.deltaPinch = 1;
            this.prevPinchDist = 0;
        }

        return true;
    }

    onTrigger(event: ITriggerEvent)
    {
        if (event.type === "wheel") {
            this.deltaWheel += math.limit(event.wheel, -1, 1);
            return true;
        }

        return false;
    }

    setViewportSize(width: number, height: number)
    {
        this.viewportWidth = width;
        this.viewportHeight = height;
    }

    updateController(object?: THREE.Object3D, adaptLimits?: boolean)
    {
        const camera = this.camera;
        object = object || camera;

        const orbit = this.orbit;
        const offset = this.offset;
        threeMath.decomposeOrbitMatrix(object.matrix, orbit, offset);
        this.orbit.multiplyScalar(threeMath.RAD2DEG);

        if (adaptLimits) {
            this.minOffset.min(offset);
            this.maxOffset.max(offset);
        }
    }

    zoomExtents(box: THREE.Box3)
    {
        const camera = this.camera;
        const offset = this.offset;

        if (!camera) {
            console.warn("CameraController.zoomExtents - camera not set");
            return;
        }

        const padding = 1.1;

        // rotate box to camera space
        _vec3a.copy(this.orbit).multiplyScalar(math.DEG2RAD);
        _vec3b.setScalar(0);
        threeMath.composeOrbitMatrix(_vec3a, _vec3b, _mat4);

        _box3.copy(box).applyMatrix4(_mat4.transpose());
        _box3.getSize(_vec3a);
        _box3.getCenter(_vec3b);

        //console.log("size", _vec3a);
        //console.log("center", _vec3b);

        offset.x = _vec3b.x;
        offset.y = _vec3b.y;

        const size = Math.max(_vec3a.x / camera.aspect, _vec3a.y);

        if (camera.isOrthographicCamera) {
            offset.z = size * padding;
        }
        else {
            const fovFactor = 1 / (2 * Math.tan(camera.fov * math.DEG2RAD * 0.5));
            offset.z = (size * fovFactor + _vec3b.z + _vec3a.z * 0.5) * padding;
        }

        this.maxOffset.z = Math.max(this.maxOffset.z, offset.z + _vec3a.z * 4);
    }

    /**
     * Updates the matrix of the given camera. If the camera's projection is orthographic,
     * updates the camera's size parameter as well.
     */
    updateCamera(object?: THREE.Object3D, force?: boolean): boolean
    {
        const camera = this.camera;
        object = object || camera;

        if (!this.update() && !force) {
            return false;
        }

        _vec3a.copy(this.orbit).multiplyScalar(math.DEG2RAD);
        _vec3b.copy(this.offset);

        if (camera.isOrthographicCamera) {
            _vec3b.z = this.maxOffset.z;
        }

        threeMath.composeOrbitMatrix(_vec3a, _vec3b, object.matrix);
        object.matrixWorldNeedsUpdate = true;

        if (camera.isOrthographicCamera) {
            camera.size = this.offset.z;
            camera.updateProjectionMatrix();
        }

        return true;
    }

    /**
     * Updates the manipulator.
     * @returns true if the state has changed during the update.
     */
    update(): boolean
    {
        if (this.phase === EManipPhase.Off && this.deltaWheel === 0) {
            return false;
        }

        if (this.deltaWheel !== 0) {
            this.updatePose(0, 0, this.deltaWheel * 0.07 + 1, 0, 0, 0);
            this.deltaWheel = 0;
            return true;
        }

        if (this.phase === EManipPhase.Active) {
            if (this.deltaX === 0 && this.deltaY === 0 && this.deltaPinch === 1) {
                return false;
            }

            this.updateByMode();
            this.deltaX = 0;
            this.deltaY = 0;
            this.deltaPinch = 1;
            return true;
        }
        else if (this.phase === EManipPhase.Release) {
            this.deltaX *= 0.85;
            this.deltaY *= 0.85;
            this.deltaPinch = 1;
            this.updateByMode();

            const delta = Math.abs(this.deltaX) + Math.abs(this.deltaY);
            if (delta < 0.1) {
                this.mode = EManipMode.Off;
                this.phase = EManipPhase.Off;
            }
            return true;
        }

        return false;
    }

    protected updateByMode()
    {
        switch(this.mode) {
            case EManipMode.Orbit:
                this.updatePose(0, 0, 1, this.deltaY, this.deltaX, 0);
                break;

            case EManipMode.Pan:
                this.updatePose(this.deltaX, this.deltaY, 1, 0, 0, 0);
                break;

            case EManipMode.Roll:
                this.updatePose(0, 0, 1, 0, 0, this.deltaX);
                break;

            case EManipMode.Dolly:
                this.updatePose(0, 0, this.deltaY * 0.0075 + 1, 0, 0, 0);
                break;

            case EManipMode.PanDolly:
                const pinchScale = (this.deltaPinch - 1) * 0.5 + 1;
                this.updatePose(this.deltaX, this.deltaY, 1 / pinchScale, 0, 0, 0);
                break;
        }
    }

    protected updatePose(dX, dY, dScale, dPitch, dHead, dRoll)
    {
        const {
            orbit, minOrbit, maxOrbit,
            offset, minOffset, maxOffset
        } = this;

        let inverse = -1;

        if (this.orientationEnabled) {
            orbit.x += inverse * dPitch * 300 / this.viewportHeight;
            orbit.y += inverse * dHead * 300 / this.viewportHeight;
            orbit.z += inverse * dRoll * 300 / this.viewportHeight;

            // check limits
            orbit.x = math.limit(orbit.x, minOrbit.x, maxOrbit.x);
            orbit.y = math.limit(orbit.y, minOrbit.y, maxOrbit.y);
            orbit.z = math.limit(orbit.z, minOrbit.z, maxOrbit.z);
        }

        if (this.offsetEnabled) {
            const factor = offset.z = dScale * offset.z;

            offset.x += dX * factor * inverse / this.viewportHeight;
            offset.y -= dY * factor * inverse / this.viewportHeight;

            // check limits
            offset.x = math.limit(offset.x, minOffset.x, maxOffset.x);
            offset.y = math.limit(offset.y, minOffset.y, maxOffset.y);
            offset.z = math.limit(offset.z, minOffset.z, maxOffset.z);
        }
    }

    protected getModeFromEvent(event: IPointerEvent): EManipMode
    {
        if (event.source === "mouse") {
            const button = event.originalEvent.button;

            // left button
            if (button === 0) {
                if (event.ctrlKey) {
                    return EManipMode.Pan;
                }
                if (event.altKey) {
                    return EManipMode.Dolly;
                }

                return EManipMode.Orbit;
            }

            // right button
            if (button === 2) {
                if (event.altKey) {
                    return EManipMode.Roll;
                }
                else {
                    return EManipMode.Pan;
                }
            }

            // middle button
            if (button === 1) {
                return EManipMode.Dolly;
            }
        }
        else if (event.source === "touch") {
            const count = event.pointerCount;

            if (count === 1) {
                return EManipMode.Orbit;
            }

            if (count === 2) {
                return EManipMode.PanDolly;
            }

            return EManipMode.Pan;
        }
    }
}