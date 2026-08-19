import * as THREE from "three";

/**
 * Analytical computation of 2D spine position and tangent on the XZ plane.
 * Local +X is the start direction.
 * Positive radius curves to the right (+Z), negative radius curves to the left (-Z).
 */
export function getLocalSpinePose(radius, length, s) {
  s = Math.max(0, Math.min(length, s));
  if (radius === 0) {
    return {
      position: new THREE.Vector3(s, 0, 0),
      heading: 0,
      forward: new THREE.Vector3(1, 0, 0),
    };
  }
  const theta = s / radius;
  return {
    position: new THREE.Vector3(
      radius * Math.sin(theta),
      0,
      radius * (1 - Math.cos(theta)),
    ),
    heading: theta,
    forward: new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta)),
  };
}

/**
 * Transforms a point (Vector3) by translating by -origin and rotating around Y by -heading.
 */
export function rebasePoint(point, origin, heading) {
  const dx = point.x - origin.x;
  const dz = point.z - origin.z;
  const ca = Math.cos(heading);
  const sa = Math.sin(heading);
  return new THREE.Vector3(
    dx * ca + dz * sa,
    point.y - origin.y,
    -dx * sa + dz * ca,
  );
}

/**
 * Represents a single track chunk with its 3D mesh and analytical spine queries.
 */
export class TrackSegment {
  constructor(opts = {}) {
    const {
      length = 50,
      radius = 0,
      position = new THREE.Vector3(0, 0, 0),
      entryHeading = 0,
      mesh = null,
    } = opts;

    this.length = length;
    this.radius = radius;
    this.mesh = mesh || new THREE.Group();

    const posVec = Array.isArray(position)
      ? new THREE.Vector3(position[0], position[1] || 0, position[2] || 0)
      : position.clone();

    this.mesh.position.copy(posVec);
    this.mesh.rotation.y = -entryHeading;
    this.mesh.updateMatrixWorld(true);

    const endLocal = getLocalSpinePose(radius, length, length);
    const exitPos = this.mesh.localToWorld(endLocal.position.clone());
    const exitHeading = entryHeading + endLocal.heading;

    this.entryPose = {
      position: posVec.clone(),
      heading: entryHeading,
    };
    this.exitPose = {
      position: exitPos,
      heading: exitHeading,
    };
  }

  /**
   * Sample the segment in world space at local arc-length `s` (0 <= s <= length).
   * Returns exact world position, forward tangent, up vector, and quaternion.
   */
  getPoseAt(s) {
    const local = getLocalSpinePose(this.radius, this.length, s);
    this.mesh.updateMatrixWorld(true);
    const position = this.mesh.localToWorld(local.position.clone());
    const forward = local.forward
      .clone()
      .transformDirection(this.mesh.matrixWorld)
      .normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(1, 0, 0),
      forward,
    );
    return {
      position,
      forward,
      up: new THREE.Vector3(0, 1, 0),
      quaternion,
      heading: this.entryPose.heading + local.heading,
    };
  }
}

/**
 * Manages a chain of TrackSegments for fixed paths, closed loops, or streaming layouts.
 */
export class Track {
  constructor(sim = null) {
    this.sim = sim;
    this.segments = [];
  }

  /**
   * Append a segment. If position / entryHeading are not supplied, attaches to previous segment's exitPose.
   */
  addSegment(segmentOrOpts) {
    let seg;
    if (segmentOrOpts instanceof TrackSegment) {
      seg = segmentOrOpts;
    } else {
      const opts = { ...segmentOrOpts };
      if (!opts.position && this.segments.length > 0) {
        const last = this.segments[this.segments.length - 1];
        opts.position = last.exitPose.position.clone();
        opts.entryHeading = last.exitPose.heading;
      }
      seg = new TrackSegment(opts);
    }

    this.segments.push(seg);
    if (this.sim && seg.mesh && !seg.mesh.parent) {
      this.sim.scene.add(seg.mesh);
    }
    return seg;
  }

  getLength() {
    return this.segments.reduce((acc, seg) => {
      const len =
        seg.length ?? seg.trackSegment?.length ?? seg.segment?.length ?? 0;
      return acc + len;
    }, 0);
  }

  /**
   * Query world pose at global arc-length `s`.
   */
  getPoseAt(s, loop = false) {
    if (this.segments.length === 0) return null;
    const totalLen = this.getLength();
    if (loop && totalLen > 0) {
      s = ((s % totalLen) + totalLen) % totalLen;
    }

    let acc = 0;
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const len =
        seg.length ?? seg.trackSegment?.length ?? seg.segment?.length ?? 0;
      if (s <= acc + len || i === this.segments.length - 1) {
        return seg.getPoseAt(s - acc);
      }
      acc += len;
    }
    return this.segments[this.segments.length - 1].getPoseAt(
      this.segments[this.segments.length - 1].length,
    );
  }
}

/**
 * Infinite streaming track with floating origin rebasing.
 * Automatically spawns new segments ahead and recycles old segments behind.
 *
 * NOTE ON FRAME UPDATE ORDERING:
 * When advancing an entity along an InfiniteTrack, always process segment recycling
 * (`track.advance()`) and station decrement (`s -= segmentLength`) BEFORE sampling
 * poses and updating entity / camera transforms for the current frame:
 *
 * ```js
 * follower.s += speed * dt;
 * while (follower.s >= track.segmentLength) {
 *   follower.s -= track.segmentLength;
 *   track.advance();
 * }
 * const pose = follower.getPose();
 * // update mesh, matrixWorld, and camera here...
 * ```
 * If transforms are sampled before `advance()`, the track segments rebase while the
 * entity/camera transforms remain in the pre-rebase coordinate space for 1 frame,
 * producing a single-frame visual jerk/glitch.
 */
export class InfiniteTrack {
  constructor(sim, opts = {}) {
    const {
      segmentLength = 50,
      windowCount = 20,
      curveGenerator = () => 0,
      segmentFactory = null,
      camera = null,
    } = opts;

    this.sim = sim;
    this.segmentLength = segmentLength;
    this.windowCount = windowCount;
    this.curveGenerator = curveGenerator;
    this.segmentFactory = segmentFactory;
    this.camera = camera || (sim ? sim.camera : null);
    this.segments = [];
    this.baseIndex = 0;

    for (let i = 0; i < this.windowCount; i++) {
      this.spawn(this.baseIndex + i);
    }
  }

  spawn(index) {
    let position = new THREE.Vector3(0, 0, 0);
    let entryHeading = 0;

    if (this.segments.length > 0) {
      const last = this.segments[this.segments.length - 1];
      position = last.exitPose.position.clone();
      entryHeading = last.exitPose.heading;
    }

    const radius = this.curveGenerator(index);
    let seg;
    if (this.segmentFactory) {
      seg = this.segmentFactory(this.sim, {
        length: this.segmentLength,
        radius,
        position,
        entryHeading,
      });
    } else {
      seg = new TrackSegment({
        length: this.segmentLength,
        radius,
        position,
        entryHeading,
      });
      if (this.sim && seg.mesh) {
        this.sim.scene.add(seg.mesh);
      }
    }

    this.segments.push(seg);
    return seg;
  }

  rebase() {
    if (this.segments.length === 0) return;
    const s0 = this.segments[0];
    const ts0 = s0.trackSegment || s0;
    const origin = ts0.entryPose.position.clone();
    const heading = ts0.entryPose.heading;

    for (const seg of this.segments) {
      const ts = seg.trackSegment || seg;
      ts.entryPose.position = rebasePoint(
        ts.entryPose.position,
        origin,
        heading,
      );
      ts.entryPose.heading -= heading;
      ts.exitPose.position = rebasePoint(ts.exitPose.position, origin, heading);
      ts.exitPose.heading -= heading;

      if (seg.segment) {
        seg.segment.entryPose.point = [
          ts.entryPose.position.x,
          ts.entryPose.position.y,
          ts.entryPose.position.z,
        ];
        seg.segment.entryPose.heading = ts.entryPose.heading;
        seg.segment.exitPose.point = [
          ts.exitPose.position.x,
          ts.exitPose.position.y,
          ts.exitPose.position.z,
        ];
        seg.segment.exitPose.heading = ts.exitPose.heading;
      }

      seg.mesh.position.copy(ts.entryPose.position);
      seg.mesh.rotation.y = -ts.entryPose.heading;
      seg.mesh.updateMatrixWorld(true);
    }

    if (this.camera) {
      this.camera.position.copy(
        rebasePoint(this.camera.position, origin, heading),
      );
    }
  }

  advance() {
    if (this.segments.length === 0) return;
    const oldSeg = this.segments.shift();
    if (this.sim && oldSeg) {
      if (oldSeg.dispose) {
        oldSeg.dispose();
      } else {
        this.sim.removeEntity(oldSeg);
      }
    }

    this.baseIndex++;
    this.rebase();
    this.spawn(this.baseIndex + this.windowCount - 1);
  }

  getPoseAt(s) {
    if (this.segments.length === 0) return null;
    let acc = 0;
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const len =
        seg.length ?? seg.trackSegment?.length ?? seg.segment?.length ?? 0;
      if (s <= acc + len || i === this.segments.length - 1) {
        return seg.getPoseAt(s - acc);
      }
      acc += len;
    }
    return this.segments[0].getPoseAt(0);
  }
}

/**
 * Attaches an entity / mesh to a track, updating its position and orientation along the spine.
 */
export class TrackFollower {
  constructor(track, mesh = null, opts = {}) {
    const {
      s = 0,
      speed = 0,
      offset = 0,
      yOffset = 0,
      forwardAxis = new THREE.Vector3(1, 0, 0),
    } = opts;

    this.track = track;
    this.mesh = mesh;
    this.s = s;
    this.speed = speed;
    this.offset = offset;
    this.yOffset = yOffset;
    this.forwardAxis = forwardAxis.clone().normalize();
    this.currentPose = null;
  }

  getPose(extraOffset = 0) {
    const totalS = this.s + this.offset + extraOffset;
    return this.track.getPoseAt(totalS);
  }

  update(dt) {
    this.s += this.speed * dt;
    this.currentPose = this.getPose();
    if (this.mesh && this.currentPose) {
      this.mesh.position.copy(this.currentPose.position);
      if (this.yOffset !== 0) {
        this.mesh.position.y += this.yOffset;
      }
      this.mesh.quaternion.setFromUnitVectors(
        this.forwardAxis,
        this.currentPose.forward,
      );
    }
    return this.currentPose;
  }
}
