/**
 * polyMesh - deterministic, tagged face extrusion for low-poly control cages.
 *
 * The editable representation keeps polygon faces until the final build step.
 * Operations address faces by persistent tags rather than topology-dependent
 * indices; the result is triangulated into a flat-shaded BufferGeometry.
 */
import * as THREE from 'three';

const AXIS_INDEX = { x: 0, y: 1, z: 2 };
const EPSILON = 1e-7;

const cloneVec = (v) => [v[0], v[1], v[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (v, scalar) => [v[0] * scalar, v[1] * scalar, v[2] * scalar];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (v) => Math.hypot(v[0], v[1], v[2]);
const normalize = (v) => {
  const len = length(v);
  return len > EPSILON ? mul(v, 1 / len) : [0, 1, 0];
};

function asVec3(value, fallback) {
  if (Array.isArray(value)) return cloneVec(value);
  if (typeof value === 'number') return [value, value, value];
  return cloneVec(fallback);
}

class EditablePolyMesh {
  constructor(vertices = [], faces = []) {
    this.vertices = vertices.map(cloneVec);
    this.faces = [];
    this.nextFaceId = 0;
    this.selection = new Set();
    this.lastCreated = new Set();

    for (const face of faces) {
      const indices = Array.isArray(face) ? face : face.vertices;
      const tags = Array.isArray(face)
        ? []
        : [...(face.tags || []), ...(face.tag ? [face.tag] : [])];
      this.addFace(indices, tags);
    }
  }

  addVertex(position) {
    this.vertices.push(cloneVec(position));
    return this.vertices.length - 1;
  }

  addFace(vertices, tags = []) {
    const face = {
      id: this.nextFaceId++,
      vertices: [...vertices],
      tags: new Set(tags.filter(Boolean))
    };
    this.faces.push(face);
    return face;
  }

  getFace(id) {
    return this.faces.find((face) => face.id === id) || null;
  }

  faceCenter(face) {
    const center = [0, 0, 0];
    for (const index of face.vertices) {
      const vertex = this.vertices[index];
      center[0] += vertex[0] / face.vertices.length;
      center[1] += vertex[1] / face.vertices.length;
      center[2] += vertex[2] / face.vertices.length;
    }
    return center;
  }

  faceNormal(face) {
    // Newell's method remains stable for convex polygons with more than four vertices.
    const normal = [0, 0, 0];
    for (let i = 0; i < face.vertices.length; i++) {
      const current = this.vertices[face.vertices[i]];
      const next = this.vertices[face.vertices[(i + 1) % face.vertices.length]];
      normal[0] += (current[1] - next[1]) * (current[2] + next[2]);
      normal[1] += (current[2] - next[2]) * (current[0] + next[0]);
      normal[2] += (current[0] - next[0]) * (current[1] + next[1]);
    }
    return normalize(normal);
  }

  select(operation = {}) {
    const criteria = operation.criteria || {};
    const tag = operation.selection || operation.tag || criteria.tag;
    let matches = [];

    if (tag) {
      const tags = Array.isArray(tag) ? tag : [tag];
      matches = this.faces.filter((face) => tags.some((candidate) => face.tags.has(candidate)));
    } else if (criteria.lastCreated || operation.lastCreated) {
      matches = this.faces.filter((face) => this.lastCreated.has(face.id));
    } else if (criteria.all || operation.all) {
      matches = [...this.faces];
    } else if (criteria.normal) {
      const axis = AXIS_INDEX[criteria.normal.axis];
      const sign = criteria.normal.direction === 'negative' ? -1 : 1;
      const threshold = criteria.normal.threshold ?? 0.9;
      matches = axis === undefined
        ? []
        : this.faces.filter((face) => this.faceNormal(face)[axis] * sign >= threshold);
    } else if (criteria.position) {
      const axis = AXIS_INDEX[criteria.position.axis];
      const value = criteria.position.value ?? 0;
      const comparison = criteria.position.comparison || 'greater';
      matches = axis === undefined ? [] : this.faces.filter((face) => {
        const coordinate = this.faceCenter(face)[axis];
        if (comparison === 'less') return coordinate < value;
        if (comparison === 'equal') return Math.abs(coordinate - value) <= EPSILON;
        return coordinate > value;
      });
    } else if (Array.isArray(criteria.indices)) {
      const ids = new Set(criteria.indices);
      matches = this.faces.filter((face) => ids.has(face.id));
    }

    if (!matches.length) {
      const label = tag || JSON.stringify(criteria);
      throw new Error(`polyMesh selection matched no faces: ${label}`);
    }
    this.selection = new Set(matches.map((face) => face.id));
    return matches;
  }

  selectedFaces(operation = {}) {
    if (operation.selection || operation.criteria) this.select(operation);
    return [...this.selection].map((id) => this.getFace(id)).filter(Boolean);
  }

  extrude(operation = {}) {
    if (operation.individual === false) {
      throw new Error('polyMesh region extrusion is not implemented; use individual faces');
    }
    const selected = this.selectedFaces(operation);
    const capIds = [];
    const removeIds = new Set(selected.map((face) => face.id));

    for (const face of selected) {
      const center = this.faceCenter(face);
      const normal = this.faceNormal(face);
      const distance = operation.distance ?? operation.amount ?? 0;
      const offset = Array.isArray(operation.offset) ? operation.offset : mul(normal, distance);
      const scale = asVec3(operation.scale ?? 1, [1, 1, 1]);
      const scalePivot = Array.isArray(operation.pivot) ? operation.pivot : center;
      const newVertices = face.vertices.map((index) => {
        const relative = sub(this.vertices[index], scalePivot);
        return this.addVertex(add(add(scalePivot, [
          relative[0] * scale[0],
          relative[1] * scale[1],
          relative[2] * scale[2]
        ]), offset));
      });

      const capTags = new Set(face.tags);
      if (operation.tag) capTags.add(operation.tag);
      const cap = this.addFace(newVertices, [...capTags]);
      capIds.push(cap.id);

      const sideTag = operation.sideTag || (operation.tag ? `${operation.tag}.side` : 'extrude.side');
      for (let i = 0; i < face.vertices.length; i++) {
        const next = (i + 1) % face.vertices.length;
        this.addFace(
          [face.vertices[i], face.vertices[next], newVertices[next], newVertices[i]],
          [sideTag]
        );
      }
    }

    this.faces = this.faces.filter((face) => !removeIds.has(face.id));
    this.selection = new Set(capIds);
    this.lastCreated = new Set(capIds);
  }

  inset(operation = {}) {
    const selected = this.selectedFaces(operation);
    const insetIds = [];
    const removeIds = new Set(selected.map((face) => face.id));
    const factorValue = operation.factor ?? operation.scale ?? (1 - (operation.amount ?? 0.25));
    const factor = asVec3(factorValue, [0.75, 0.75, 0.75]);

    for (const face of selected) {
      const center = this.faceCenter(face);
      const innerVertices = face.vertices.map((index) => {
        const relative = sub(this.vertices[index], center);
        return this.addVertex(add(center, [
          relative[0] * factor[0],
          relative[1] * factor[1],
          relative[2] * factor[2]
        ]));
      });

      const innerTags = new Set(face.tags);
      if (operation.tag) innerTags.add(operation.tag);
      const inner = this.addFace(innerVertices, [...innerTags]);
      insetIds.push(inner.id);

      const borderTag = operation.borderTag || (operation.tag ? `${operation.tag}.border` : 'inset.border');
      for (let i = 0; i < face.vertices.length; i++) {
        const next = (i + 1) % face.vertices.length;
        this.addFace(
          [face.vertices[i], face.vertices[next], innerVertices[next], innerVertices[i]],
          [borderTag]
        );
      }
    }

    this.faces = this.faces.filter((face) => !removeIds.has(face.id));
    this.selection = new Set(insetIds);
    this.lastCreated = new Set(insetIds);
  }

  selectedVertexIndices(operation = {}) {
    const faces = this.selectedFaces(operation);
    return [...new Set(faces.flatMap((face) => face.vertices))];
  }

  translate(operation = {}) {
    const offset = asVec3(operation.offset, [0, 0, 0]);
    for (const index of this.selectedVertexIndices(operation)) {
      this.vertices[index] = add(this.vertices[index], offset);
    }
  }

  selectionCenter(indices) {
    const center = [0, 0, 0];
    for (const index of indices) {
      const vertex = this.vertices[index];
      center[0] += vertex[0] / indices.length;
      center[1] += vertex[1] / indices.length;
      center[2] += vertex[2] / indices.length;
    }
    return center;
  }

  scale(operation = {}) {
    const indices = this.selectedVertexIndices(operation);
    if (!indices.length) return;
    const factor = asVec3(operation.factor ?? operation.scale ?? 1, [1, 1, 1]);
    const pivot = Array.isArray(operation.pivot) ? operation.pivot : this.selectionCenter(indices);
    for (const index of indices) {
      const relative = sub(this.vertices[index], pivot);
      this.vertices[index] = add(pivot, [
        relative[0] * factor[0],
        relative[1] * factor[1],
        relative[2] * factor[2]
      ]);
    }
  }

  rotate(operation = {}) {
    const indices = this.selectedVertexIndices(operation);
    if (!indices.length) return;
    const axisValue = operation.axis || 'y';
    const axis = Array.isArray(axisValue)
      ? normalize(axisValue)
      : [axisValue === 'x' ? 1 : 0, axisValue === 'y' ? 1 : 0, axisValue === 'z' ? 1 : 0];
    const radians = THREE.MathUtils.degToRad(operation.angle ?? 0);
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const pivot = Array.isArray(operation.pivot) ? operation.pivot : this.selectionCenter(indices);

    for (const index of indices) {
      const relative = sub(this.vertices[index], pivot);
      const rotated = add(
        add(mul(relative, cosine), mul(cross(axis, relative), sine)),
        mul(axis, dot(axis, relative) * (1 - cosine))
      );
      this.vertices[index] = add(pivot, rotated);
    }
  }

  mirror(modifier = {}) {
    const axis = AXIS_INDEX[modifier.axis || 'x'];
    if (axis === undefined) throw new Error(`polyMesh mirror axis must be x, y, or z`);
    const threshold = modifier.threshold ?? 1e-5;

    // Center-plane faces are construction caps. Removing them makes the two
    // halves one closed surface after their center vertices are shared.
    this.faces = this.faces.filter((face) =>
      !face.vertices.every((index) => Math.abs(this.vertices[index][axis]) <= threshold)
    );

    const sourceFaces = [...this.faces];
    const mirrorVertex = new Map();
    const mapVertex = (index) => {
      if (mirrorVertex.has(index)) return mirrorVertex.get(index);
      const source = this.vertices[index];
      if (Math.abs(source[axis]) <= threshold) {
        source[axis] = 0;
        mirrorVertex.set(index, index);
        return index;
      }
      const mirrored = cloneVec(source);
      mirrored[axis] *= -1;
      const mirroredIndex = this.addVertex(mirrored);
      mirrorVertex.set(index, mirroredIndex);
      return mirroredIndex;
    };

    for (const face of sourceFaces) {
      const mirrored = face.vertices.map(mapVertex).reverse();
      this.addFace(mirrored, [...face.tags]);
    }
  }

  applyOperation(operation) {
    switch (operation.op) {
      case 'select': this.select(operation); break;
      case 'extrude': this.extrude(operation); break;
      case 'inset': this.inset(operation); break;
      case 'translate': this.translate(operation); break;
      case 'scale': this.scale(operation); break;
      case 'rotate': this.rotate(operation); break;
      default: throw new Error(`unknown polyMesh operation: ${operation.op}`);
    }
  }
}

function cubeBase(base = {}) {
  const [width, height, depth] = asVec3(base.size, [1, 1, 1]);
  const [cx, cy, cz] = asVec3(base.center, [0, 0, 0]);
  const x = width / 2;
  const y = height / 2;
  const z = depth / 2;
  const vertices = [
    [cx - x, cy - y, cz - z], [cx + x, cy - y, cz - z],
    [cx + x, cy + y, cz - z], [cx - x, cy + y, cz - z],
    [cx - x, cy - y, cz + z], [cx + x, cy - y, cz + z],
    [cx + x, cy + y, cz + z], [cx - x, cy + y, cz + z]
  ];
  const faces = [
    { vertices: [0, 3, 2, 1], tag: 'back' },
    { vertices: [4, 5, 6, 7], tag: 'front' },
    { vertices: [0, 4, 7, 3], tag: 'left' },
    { vertices: [1, 2, 6, 5], tag: 'right' },
    { vertices: [0, 1, 5, 4], tag: 'bottom' },
    { vertices: [3, 7, 6, 2], tag: 'top' }
  ];
  return new EditablePolyMesh(vertices, faces);
}

function createEditableMesh(definition) {
  const base = definition.base || {};
  if ((base.type || 'cube') === 'cube') return cubeBase(base);
  if (base.type === 'mesh') {
    return new EditablePolyMesh(base.vertices || [], base.faces || []);
  }
  throw new Error(`unknown polyMesh base type: ${base.type}`);
}

export function buildPolyMeshGeometry(definition = {}) {
  const mesh = createEditableMesh(definition);
  for (const operation of definition.operations || []) mesh.applyOperation(operation);
  for (const modifier of definition.modifiers || []) {
    if (modifier.type === 'mirror') mesh.mirror(modifier);
    else throw new Error(`unknown polyMesh modifier: ${modifier.type}`);
  }

  const positions = [];
  for (const face of mesh.faces) {
    if (face.vertices.length < 3) continue;
    const anchor = mesh.vertices[face.vertices[0]];
    for (let i = 1; i < face.vertices.length - 1; i++) {
      const b = mesh.vertices[face.vertices[i]];
      const c = mesh.vertices[face.vertices[i + 1]];
      if (length(cross(sub(b, anchor), sub(c, anchor))) <= EPSILON) continue;
      positions.push(...anchor, ...b, ...c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.userData.polyMesh = {
    vertices: mesh.vertices.length,
    faces: mesh.faces.length,
    triangles: positions.length / 9
  };
  return geometry;
}
