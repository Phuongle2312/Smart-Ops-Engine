package com.soe.repository;

import com.soe.entity.Node;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface NodeRepository extends JpaRepository<Node, Long> {
    Optional<Node> findByHost(String host);
    Optional<Node> findByName(String name);
    java.util.List<Node> findByActiveTrue();
}
